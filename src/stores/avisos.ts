import { create } from "zustand";

/**
 * Os avisos (o `toast` do web).
 *
 * O painel usa `sonner`, que é DOM. Aqui é um store com uma fila e um componente
 * que a desenha — poucas linhas, e evita mais uma dependência.
 *
 * Existe para que nenhuma tela esqueça de tratar falha: o hook de mutação
 * publica o erro daqui, então o pior resultado possível (o botão parar de girar
 * e nada acontecer) não é alcançável por esquecimento.
 */

export type TipoDeAviso = "sucesso" | "erro" | "informacao";

export interface Aviso {
  id: number;
  tipo: TipoDeAviso;
  texto: string;
}

/** Erro fica mais tempo: costuma ter o que ler, e às vezes o que anotar. */
const DURACAO: Record<TipoDeAviso, number> = {
  sucesso: 2600,
  informacao: 3200,
  erro: 5000,
};

interface EstadoAvisos {
  fila: Aviso[];
  publicar: (tipo: TipoDeAviso, texto: string) => void;
  descartar: (id: number) => void;
}

let proximoId = 1;

export const useAvisos = create<EstadoAvisos>((set, get) => ({
  fila: [],

  publicar: (tipo, texto) => {
    if (!texto) return;

    const id = proximoId++;
    // Três é o teto: acima disso o aviso mais novo — o que o usuário acabou de
    // causar — sairia da tela empurrado pelos antigos.
    set((estado) => ({ fila: [...estado.fila, { id, tipo, texto }].slice(-3) }));

    setTimeout(() => get().descartar(id), DURACAO[tipo]);
  },

  descartar: (id) => set((estado) => ({ fila: estado.fila.filter((a) => a.id !== id) })),
}));

/** Atalhos, para as telas não repetirem a string do tipo. */
export const avisar = {
  sucesso: (texto: string) => useAvisos.getState().publicar("sucesso", texto),
  erro: (texto: string) => useAvisos.getState().publicar("erro", texto),
  informacao: (texto: string) => useAvisos.getState().publicar("informacao", texto),
};
