import { create } from "zustand";

import { ehAba, type NomeDeAba, type Rota } from "../navigation/rotas";

/**
 * A pilha de navegação.
 *
 * Uma pilha por aba, e não uma pilha global: quem estava lendo a ficha de um
 * cliente, foi ver uma entrega e voltou para Clientes espera encontrar a ficha
 * aberta, não a lista. Uma pilha global perderia esse contexto a cada troca de
 * aba, e no balcão isso custa uma busca repetida com o cliente esperando.
 */

type Pilhas = Record<NomeDeAba, Rota[]>;

const PILHAS_INICIAIS: Pilhas = {
  inicio: [{ nome: "inicio" }],
  campanhas: [{ nome: "campanhas" }],
  clientes: [{ nome: "clientes" }],
  entregas: [{ nome: "entregas" }],
  lancamentos: [{ nome: "lancamentos" }],
  equipe: [{ nome: "equipe" }],
  empresas: [{ nome: "empresas" }],
};

interface EstadoNavegacao {
  aba: NomeDeAba;
  pilhas: Pilhas;

  /** A rota visível agora. */
  atual: () => Rota;
  /** `true` quando há para onde voltar dentro da aba. */
  podeVoltar: () => boolean;

  /** Empilha uma rota sobre a aba atual. */
  abrir: (rota: Rota) => void;
  /** Volta uma rota. Devolve `false` quando já está na raiz da aba. */
  voltar: () => boolean;
  /**
   * Troca de aba. Tocar na aba em que já se está volta à raiz dela — é o gesto
   * que todo aplicativo de aba tem, e serve de saída rápida de uma pilha funda.
   */
  irPara: (aba: NomeDeAba) => void;
  /** Descarta tudo. Usado ao sair e ao entrar, para não vazar tela entre sessões. */
  reiniciar: () => void;
}

const clonar = (): Pilhas => ({
  inicio: [{ nome: "inicio" }],
  campanhas: [{ nome: "campanhas" }],
  clientes: [{ nome: "clientes" }],
  entregas: [{ nome: "entregas" }],
  lancamentos: [{ nome: "lancamentos" }],
  equipe: [{ nome: "equipe" }],
  empresas: [{ nome: "empresas" }],
});

export const useNavegacao = create<EstadoNavegacao>((set, get) => ({
  aba: "inicio",
  pilhas: PILHAS_INICIAIS,

  atual: () => {
    const { aba, pilhas } = get();
    const pilha = pilhas[aba];
    return pilha[pilha.length - 1] ?? { nome: aba };
  },

  podeVoltar: () => get().pilhas[get().aba].length > 1,

  abrir: (rota) => {
    // Abrir uma aba pela rota (e não pelo menu) é troca de aba, não empilhamento:
    // empilhar "clientes" sobre "clientes" daria dois níveis idênticos.
    if (ehAba(rota.nome)) {
      get().irPara(rota.nome);
      return;
    }

    set((estado) => ({
      pilhas: {
        ...estado.pilhas,
        [estado.aba]: [...estado.pilhas[estado.aba], rota],
      },
    }));
  },

  voltar: () => {
    const { aba, pilhas } = get();
    if (pilhas[aba].length <= 1) return false;

    set({ pilhas: { ...pilhas, [aba]: pilhas[aba].slice(0, -1) } });
    return true;
  },

  irPara: (aba) => {
    const estado = get();

    if (estado.aba === aba) {
      // Segundo toque na aba atual: volta à raiz.
      if (estado.pilhas[aba].length > 1) {
        set({ pilhas: { ...estado.pilhas, [aba]: [{ nome: aba } as Rota] } });
      }
      return;
    }

    set({ aba });
  },

  reiniciar: () => set({ aba: "inicio", pilhas: clonar() }),
}));
