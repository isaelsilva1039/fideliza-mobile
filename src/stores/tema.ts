import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { definirEsquema, type Esquema } from "../theme";

/**
 * O tema escolhido.
 *
 * Guarda a preferência e a aplica na paleta. Duas coisas separadas de propósito:
 * o `theme` sabe quais são as cores de cada esquema, este store sabe qual delas
 * a pessoa quer — e é ele quem sobrevive ao fechar o app.
 *
 * <p><b>O claro é o padrão, e o sistema não é consultado.</b> O balcão trabalha
 * de dia, em tela de loja, e é para ele que a paleta foi desenhada. Seguir o
 * aparelho faria o app inteiro trocar de cor ao anoitecer sem ninguém ter pedido.
 *
 * <p>A gravação não bloqueia a troca: a cor muda na hora e o disco é atualizado
 * depois. Falha ao gravar custa a preferência na próxima abertura, e não a troca
 * que a pessoa acabou de fazer.
 */

const CHAVE = "fideliza.tema";

interface EstadoTema {
  esquema: Esquema;
  /** Já leu o disco? Antes disso a raiz não deve desenhar, para não piscar. */
  carregado: boolean;
  carregar: () => Promise<void>;
  alternar: () => void;
  definir: (esquema: Esquema) => void;
}

export const useTema = create<EstadoTema>((set, get) => ({
  esquema: "claro",
  carregado: false,

  carregar: async () => {
    try {
      const gravado = await AsyncStorage.getItem(CHAVE);
      const esquema: Esquema = gravado === "escuro" ? "escuro" : "claro";
      definirEsquema(esquema);
      set({ esquema, carregado: true });
    } catch {
      // Sem preferência legível, segue o padrão. Não é motivo para travar o app.
      set({ carregado: true });
    }
  },

  alternar: () => get().definir(get().esquema === "escuro" ? "claro" : "escuro"),

  definir: (esquema) => {
    definirEsquema(esquema);
    set({ esquema });
    void AsyncStorage.setItem(CHAVE, esquema).catch(() => {
      // Preferência não gravada: volta ao padrão na próxima abertura, e só.
    });
  },
}));
