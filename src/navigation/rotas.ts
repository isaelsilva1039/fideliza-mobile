import type { Permissao } from "../constants/permissoes";

/**
 * As rotas, como união discriminada.
 *
 * Não há `react-navigation` aqui de propósito. Ele traria quatro módulos nativos
 * (`react-native-screens`, `safe-area-context`, `gesture-handler`,
 * `reanimated`), e o app precisa rodar no Expo Go que está na App Store — o
 * único disponível para iPhone hoje. Um roteador de pilha é pequeno o suficiente
 * para ser escrito à mão, e o tipo abaixo dá a mesma segurança que os
 * `ParamList` do react-navigation: parâmetro faltando é erro de compilação.
 *
 * A troca é consciente: perde-se a animação de transição nativa e o gesto de
 * voltar por arraste. Ganha-se rodar no aparelho do usuário sem build próprio.
 */
export type Rota =
  /* Abas ------------------------------------------------------------------- */
  | { nome: "inicio" }
  | { nome: "campanhas" }
  | { nome: "clientes" }
  | { nome: "entregas" }
  | { nome: "lancamentos" }
  | { nome: "equipe" }
  | { nome: "empresas" }
  /* Empilhadas ------------------------------------------------------------- */
  | { nome: "campanha"; id: string }
  | { nome: "campanha-form"; id?: string }
  | { nome: "participantes"; id: string }
  | { nome: "cliente"; id: string }
  | { nome: "cliente-form" }
  | { nome: "registrar-compra"; clienteId?: string; campanhaId?: string }
  | { nome: "configuracoes" };

export type NomeDeRota = Rota["nome"];

/** As rotas que são aba — raiz da pilha, nunca empilhadas sobre outra. */
export const ABAS = [
  "inicio",
  "campanhas",
  "clientes",
  "entregas",
  "lancamentos",
  "equipe",
  "empresas",
] as const;

export type NomeDeAba = (typeof ABAS)[number];

export const ehAba = (nome: NomeDeRota): nome is NomeDeAba =>
  (ABAS as readonly string[]).includes(nome);

/* -------------------------------------------------------------------------- */
/* O menu                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Os itens do menu, na ordem do painel web.
 *
 * Os quatro primeiros respondem a perguntas que o usuário já tinha antes de
 * abrir o app — "como foi o dia?", "o que está no ar?", "quem é esse cliente?",
 * "o que tenho pra entregar?". Daqui para baixo, o que depende do perfil: não
 * aparece para o balcão, e por isso não polui o menu de quem só atende.
 *
 * Configurações não está aqui, como no web: é algo que se mexe uma vez e some,
 * então mora no menu do perfil.
 */
export interface ItemDeMenu {
  rota: NomeDeAba;
  titulo: string;
  /** Nome do ícone no conjunto Ionicons. */
  icone: string;
  /** Frase de apoio, exibida no menu completo. */
  dica: string;
  /** Quando presente, o item só aparece para quem tem a permissão. */
  permissao?: Permissao;
}

export const MENU: readonly ItemDeMenu[] = [
  {
    rota: "inicio",
    titulo: "Início",
    icone: "home-outline",
    dica: "Como está o movimento hoje",
  },
  {
    rota: "campanhas",
    titulo: "Campanhas",
    icone: "megaphone-outline",
    dica: "Cartões fidelidade e sorteios",
  },
  {
    rota: "clientes",
    titulo: "Clientes",
    icone: "people-outline",
    dica: "Quem participa das suas campanhas",
  },
  {
    rota: "entregas",
    titulo: "Entregas",
    icone: "gift-outline",
    dica: "Prêmios esperando o cliente",
  },
  {
    rota: "lancamentos",
    titulo: "Lançamentos",
    icone: "clipboard-outline",
    dica: "Quem lançou o quê, e quando",
    permissao: "auditoria.ver",
  },
  {
    rota: "equipe",
    titulo: "Equipe",
    icone: "people-circle-outline",
    dica: "Quem trabalha aqui",
    permissao: "equipe.gerenciar",
  },
  {
    rota: "empresas",
    titulo: "Empresas",
    icone: "business-outline",
    dica: "As lojas que você administra",
    permissao: "empresas.gerenciar",
  },
];

/** Título exibido no topo de cada rota empilhada. */
export const TITULOS: Record<NomeDeRota, string> = {
  inicio: "Início",
  campanhas: "Campanhas",
  clientes: "Clientes",
  entregas: "Entregas",
  lancamentos: "Lançamentos",
  equipe: "Equipe",
  empresas: "Empresas",
  campanha: "Campanha",
  "campanha-form": "Campanha",
  participantes: "Participantes",
  cliente: "Ficha do cliente",
  "cliente-form": "Novo cliente",
  "registrar-compra": "Registrar compra",
  configuracoes: "Configurações",
};
