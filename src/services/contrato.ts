/**
 * O contrato da API, em TypeScript.
 *
 * Cada tipo aqui espelha um record do backend em Java, com os mesmos nomes de
 * campo — o app fala o mesmo vocabulário que o servidor, em português. Isso é
 * deliberado: manter um segundo vocabulário em inglês obrigaria a traduzir ida e
 * volta em toda tela, e o único ganho seria estético, já que backend, telas e
 * usuários são todos em português.
 *
 * Duas armadilhas do contrato, ambas verificadas contra a API rodando:
 *
 * 1. **Dinheiro é `long` em centavos.** `valor: 12000` é R$ 120,00. Vale para
 *    `valorCompra`, `totalGasto`, `valorMovimentado` e `valorPorCupom` — na ida
 *    e na volta. Use `moeda()` para exibir e `centavosDeTexto()` para ler.
 *
 * 2. **Campo nulo não vem.** O servidor roda com
 *    `default-property-inclusion: non_null`, então `variacao`, `sorteiaEm` e
 *    `instrucoesRetirada` simplesmente não aparecem no JSON. Por isso são
 *    opcionais aqui, e não `T | null`.
 */

/* -------------------------------------------------------------------------- */
/* Enumerações                                                                */
/* -------------------------------------------------------------------------- */

export type Perfil = "DONO" | "ADMINISTRADOR" | "FUNCIONARIO";
export type SituacaoUsuario = "ATIVO" | "INATIVO";
export type SituacaoEmpresa = "ATIVA" | "INATIVA";
export type SituacaoCliente = "ATIVO" | "INATIVO";
export type TipoCampanha = "CARTAO_FIDELIDADE" | "SORTEIO";
export type SituacaoCampanha = "RASCUNHO" | "ATIVA" | "PAUSADA" | "ENCERRADA" | "SORTEADA";
export type SituacaoEntrega = "AGUARDANDO" | "ENTREGUE" | "CANCELADA";
export type SituacaoLancamento = "CONFIRMADO" | "CANCELADO";
export type TipoBeneficio = "SELOS" | "CUPONS";
export type SituacaoPremio = "DISPONIVEL" | "ESGOTADO";
export type GravidadeSinal = "ATENCAO" | "ALERTA";

/**
 * Para onde cada situação de campanha pode ir.
 *
 * O servidor já manda `proximasSituacoes` em cada campanha, e é ele que decide.
 * Esta tabela existe só para rotular o botão antes da resposta chegar — nunca
 * para autorizar a transição.
 */
export const ROTULO_TRANSICAO: Record<SituacaoCampanha, string> = {
  RASCUNHO: "Publicar",
  ATIVA: "Ativar",
  PAUSADA: "Pausar",
  ENCERRADA: "Encerrar",
  SORTEADA: "Sortear",
};

export const ROTULO_SITUACAO_CAMPANHA: Record<SituacaoCampanha, string> = {
  RASCUNHO: "Rascunho",
  ATIVA: "No ar",
  PAUSADA: "Pausada",
  ENCERRADA: "Encerrada",
  SORTEADA: "Sorteada",
};

export const ROTULO_TIPO_CAMPANHA: Record<TipoCampanha, string> = {
  CARTAO_FIDELIDADE: "Cartão fidelidade",
  SORTEIO: "Sorteio",
};

export const ROTULO_SITUACAO_ENTREGA: Record<SituacaoEntrega, string> = {
  AGUARDANDO: "Aguardando",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

export const ROTULO_PERFIL: Record<Perfil, string> = {
  DONO: "Dono",
  ADMINISTRADOR: "Administrador",
  FUNCIONARIO: "Funcionário",
};

export const ROTULO_BENEFICIO: Record<TipoBeneficio, string> = {
  SELOS: "selos",
  CUPONS: "cupons",
};

/* -------------------------------------------------------------------------- */
/* Envelope de página                                                         */
/* -------------------------------------------------------------------------- */

export interface Pagina<T> {
  content: T[];
  /** 1-based, como o backend numera. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Página vazia, para a tela ter algo coerente antes da primeira resposta. */
export function paginaVazia<T>(size = 20): Pagina<T> {
  return { content: [], page: 1, size, totalElements: 0, totalPages: 0 };
}

/* -------------------------------------------------------------------------- */
/* Identidade                                                                 */
/* -------------------------------------------------------------------------- */

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  telefone?: string;
  situacao: SituacaoUsuario;
  ultimoAcessoEm?: string;
  empresaIds: string[];
}

export interface Empresa {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  documento: string;
  situacao: SituacaoEmpresa;
  telefone?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  criadoEm: string;
}

export interface Sessao {
  usuario: Usuario;
  empresaAtivaId: string;
  empresas: Empresa[];
}

/* -------------------------------------------------------------------------- */
/* Campanhas                                                                  */
/* -------------------------------------------------------------------------- */

export interface Regra {
  /** Centavos. */
  valorMinimoCompra?: number;
  selosNecessarios?: number;
  /** Centavos gastos por cupom. */
  valorPorCupom?: number;
  limiteTotalCupons?: number;
  limiteDiarioCliente?: number;
}

export interface Premio {
  id: string;
  /** 1, 2, 3… A ordem da apuração, e o número que o dono anuncia no dia. */
  ordem: number;
  nome: string;
  descricao: string;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  quantidadeEntregue: number;
  situacao: SituacaoPremio;
  instrucoesRetirada?: string;
  estoqueBaixo: boolean;
}

export interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoCampanha;
  situacao: SituacaoCampanha;
  iniciaEm: string;
  terminaEm: string;
  sorteiaEm?: string;
  regra: Regra;
  /**
   * O que o cliente ganha, em ordem de apuração.
   *
   * Sorteio pode ter vários — o atacadão que roda a campanha o ano inteiro e no
   * dia sorteia a TV, depois a moto, tudo da mesma urna de cupons. Cartão
   * fidelidade tem um só.
   */
  premios: Premio[];
  /** Se quem já levou um prêmio concorre aos seguintes. */
  ganhadorPodeRepetir: boolean;
  totalParticipantes: number;
  totalLancamentos: number;
  totalBeneficios?: number;
  /** Centavos. */
  valorMovimentado: number;
  /** Frase pronta do servidor: "1 selo a cada R$ 20,00". */
  regraEmUmaFrase: string;
  podeSortear: boolean;
  funcionarioPodePublicar: boolean;
  funcionarioPodePausar: boolean;
  funcionarioPodeEncerrar: boolean;
  funcionarioPodeSortear: boolean;
  /** Transições que o servidor aceita agora. Vazio quando não há mais nenhuma. */
  proximasSituacoes: SituacaoCampanha[];
}

export interface Ganhador {
  clienteId: string;
  nome: string;
  documento: string;
  telefone: string;
  numeroCupom: string;
  posicao: number;
}

export interface Sorteio {
  id: string;
  /** Qual prêmio esta apuração sorteou. */
  premioId?: string;
  realizadoEm: string;
  /** Hash da lista de cupons — é o que torna o sorteio auditável. */
  hashLista: string;
  totalParticipantes: number;
  totalCupons: number;
  nomePremio: string;
  ganhadores: Ganhador[];
}

export interface DetalheCampanha {
  campanha: Campanha;
  totalBeneficios: number;
  /** Uma por prêmio já apurado, na ordem em que saíram. Vazia se nenhuma. */
  sorteios: Sorteio[];
}

export interface Participante {
  clienteId: string;
  nome: string;
  /** Mascarado na listagem. */
  documento: string;
  telefone: string;
  quantidade: number;
  /** Centavos. */
  totalGasto: number;
  ultimaParticipacao: string;
}

/* -------------------------------------------------------------------------- */
/* Clientes                                                                   */
/* -------------------------------------------------------------------------- */

export interface Cliente {
  id: string;
  nome: string;
  /** Mascarado na listagem; inteiro na ficha individual. */
  documento: string;
  codigoCartao: string;
  telefone: string;
  email?: string;
  situacao: SituacaoCliente;
  /** Centavos. */
  totalGasto: number;
  criadoEm: string;
  ultimaAtividadeEm: string;
}

export interface Lancamento {
  id: string;
  codigo: string;
  campanhaId: string;
  clienteId: string;
  usuarioId: string;
  /** Centavos. */
  valorCompra: number;
  tipoBeneficio: TipoBeneficio;
  quantidadeBeneficio: number;
  situacao: SituacaoLancamento;
  criadoEm: string;
  motivoCancelamento?: string;
  canceladoEm?: string;
}

/** Um cartão de selos na ficha do cliente. */
export interface CartaoNaFicha {
  empresa: string;
  campanhaId: string;
  campanha: string;
  premio: string;
  selosAtuais: number;
  selosNecessarios: number;
  faltam: number;
  vezesCompletado: number;
}

export interface SorteioNaFicha {
  empresa: string;
  campanhaId: string;
  campanha: string;
  premio: string;
  situacao: SituacaoCampanha;
  limiteTotalCupons?: number;
  cupons: number;
}

export interface PremioNaFicha {
  empresa: string;
  id: string;
  codigo: string;
  premio: string;
  campanha: string;
  situacao: SituacaoEntrega;
  solicitadoEm: string;
  entregueEm?: string;
}

export interface CompraNaFicha {
  lancamento: Lancamento;
  campanha: string;
}

export interface FichaCliente {
  cliente: Cliente;
  cartoes: CartaoNaFicha[];
  sorteios: SorteioNaFicha[];
  compras: CompraNaFicha[];
  premios: PremioNaFicha[];
}

/* -------------------------------------------------------------------------- */
/* Entregas                                                                   */
/* -------------------------------------------------------------------------- */

export interface Entrega {
  id: string;
  codigo: string;
  situacao: SituacaoEntrega;
  clienteId: string;
  cliente: string;
  telefoneCliente: string;
  campanhaId: string;
  campanha: string;
  premioId: string;
  premio: string;
  instrucoesRetirada?: string;
  solicitadoEm: string;
  entregueEm?: string;
  documentoConferido?: string;
  entregueParaTerceiro?: boolean;
  recebedorNome?: string;
  recebedorDocumento?: string;
  observacao?: string;
}

/* -------------------------------------------------------------------------- */
/* Equipe e configuração                                                      */
/* -------------------------------------------------------------------------- */

export interface Membro {
  usuario: Usuario;
  /** Compras confirmadas que a pessoa registrou no mês corrente. */
  lancamentosNoMes: number;
}

export interface Configuracao {
  avisarCliente: boolean;
  /**
   * Manda o aviso também por WhatsApp, além da lista da consulta do cliente.
   *
   * Chave separada de `avisarCliente` porque responde outra pergunta: a loja que
   * ficou sem número conectado precisa parar de tentar enviar sem perder os
   * avisos do portal.
   */
  avisarWhatsapp: boolean;
  bloquearProprioCpf: boolean;
  bloquearDuplicados: boolean;
  /** Quando ativo, o rosto identifica e o código do telefone ainda autentica. */
  rostoExigeCodigo: boolean;
}

/**
 * Estado do número de WhatsApp da plataforma.
 *
 * A falha mais comum é silenciosa: a instância desconecta do celular e toda
 * mensagem passa a ser recusada. Sem uma tela dizendo isso, a loja só descobre
 * quando um cliente reclama que parou de receber.
 */
export interface EstadoWhatsApp {
  /** Falso significa envio simulado — não é erro, é ambiente sem credencial. */
  configurado: boolean;
  conectado: boolean;
  /** O aparelho pareado está com internet. Sem isso a mensagem fica parada. */
  celularConectado: boolean;
  /** O que o provedor respondeu, para mostrar como está. */
  detalhe: string;
}

/* -------------------------------------------------------------------------- */
/* Início                                                                     */
/* -------------------------------------------------------------------------- */

export interface Indicador {
  /** Centavos quando é dinheiro; contagem nos demais. */
  valor: number;
  /** Fração (`0.12` é +12%). Ausente quando não há período anterior. */
  variacao?: number;
}

export interface PontoDoDia {
  /** `YYYY-MM-DD`. */
  dia: string;
  /** Centavos. */
  valor: number;
}

export interface CampanhaResumo {
  id: string;
  nome: string;
  tipo: TipoCampanha;
  situacao: SituacaoCampanha;
  participantes: number;
  premio: string;
}

export interface CompraRecente {
  id: string;
  codigo: string;
  cliente: string;
  campanha: string;
  /** Centavos. */
  valor: number;
  /** Frase pronta: "5 cupons". */
  beneficio: string;
  quando: string;
}

export interface EntregaPendente {
  id: string;
  codigo: string;
  cliente: string;
  premio: string;
  desde: string;
}

export interface PremioEntregue {
  id: string;
  codigo: string;
  cliente: string;
  premio: string;
  entregueEm: string;
  recebedor: string;
}

export interface SorteioPronto {
  id: string;
  campanha: string;
  premio: string;
  participantes: number;
  cupons: number;
  encerradaEm: string;
}

export interface ProximoSorteio {
  id: string;
  campanha: string;
  premio: string;
  sorteiaEm: string;
  participantes: number;
}

export interface QuaseLa {
  clienteId: string;
  cliente: string;
  telefone: string;
  campanhaId: string;
  campanha: string;
  premio: string;
  selosAtuais: number;
  selosNecessarios: number;
  faltam: number;
}

export interface ResumoInicio {
  movimento: Indicador;
  clientesQueCompraram: Indicador;
  beneficiosEntregues: Indicador;
  campanhasNoAr: number;
  clientesInativos: number;
  movimentoPorDia: PontoDoDia[];
  campanhas: CampanhaResumo[];
  ultimasCompras: CompraRecente[];
  entregasPendentes: EntregaPendente[];
  premiosEntregues: PremioEntregue[];
  sorteiosProntos: SorteioPronto[];
  proximosSorteios: ProximoSorteio[];
  quaseCompletando: QuaseLa[];
}

/* -------------------------------------------------------------------------- */
/* Auditoria                                                                  */
/* -------------------------------------------------------------------------- */

export interface SinalAuditoria {
  id: string;
  /** O que foi observado, já com os números. */
  rotulo: string;
  /** Por que chama atenção — e o que pode explicá-lo sem má-fé. */
  detalhe: string;
  gravidade: GravidadeSinal;
}

export interface ResumoPorPessoa {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
  situacao: SituacaoUsuario;
  confirmados: number;
  cancelados: number;
  /** Centavos. */
  valorTotal: number;
  clientesDistintos: number;
  clienteMaisAtendido?: string;
  vezesNoMesmoCliente: number;
  sinais: SinalAuditoria[];
}

export interface LinhaAuditoria {
  lancamento: Lancamento;
  usuario: string;
  cliente: string;
  campanha: string;
  marcas: string[];
}

export interface RelatorioAuditoria {
  janelaEmDias: number;
  resumo: ResumoPorPessoa[];
  linhas: Pagina<LinhaAuditoria>;
}

/* -------------------------------------------------------------------------- */
/* Compra                                                                     */
/* -------------------------------------------------------------------------- */

export interface ResultadoCompra {
  lancamento: Lancamento;
  cartaoCompletou: boolean;
  entregaGeradaId?: string;
  codigoEntrega?: string;
  /** Frase pronta do servidor: "1 selo para Ana" ou "Cartão completo!". */
  mensagem: string;
}

/* -------------------------------------------------------------------------- */
/* Portal do cliente                                                          */
/* -------------------------------------------------------------------------- */

export interface PedidoDeCodigo {
  pedidoId: string;
  /** `"(99) *****-2233"` — confirma o aparelho sem revelar o número. */
  finalDoTelefone: string;
  /**
   * Só existe enquanto o envio de mensagem é simulado. Com envio real este campo
   * some, e o código deixa de voltar — devolvê-lo anula a proteção que ele dá.
   */
  codigoDemonstracao?: string;
}

/**
 * Os cartões do cliente vêm de **todas** as empresas em que ele participa, não
 * só da que emitiu o código: cada item traz o próprio `empresa`, que difere do
 * `empresa` do topo. A tela agrupa por isso.
 */
export interface CartaoDoCliente {
  empresa: string;
  campanhaId: string;
  campanha: string;
  premio: string;
  selosAtuais: number;
  selosNecessarios: number;
  vezesCompletado: number;
  terminaEm: string;
}

export interface SorteioDoCliente {
  empresa: string;
  campanhaId: string;
  campanha: string;
  premio: string;
  situacao: SituacaoCampanha;
  cupons: number;
  limiteTotalCupons?: number;
  sorteiaEm?: string;
  sorteado: boolean;
  ganhou: boolean;
}

export interface PremioDoCliente {
  empresa: string;
  id: string;
  codigo: string;
  premio: string;
  campanha: string;
  instrucoesRetirada?: string;
  desde: string;
}

export type TipoNotificacao = "NOVA_CAMPANHA" | "BENEFICIO_RECEBIDO";

export interface NotificacaoDoCliente {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  destinoTipo: string;
  destinoId: string;
  criadaEm: string;
  lidaEm?: string | null;
}

export interface CartaoDoPortal {
  primeiroNome: string;
  empresa: string;
  codigoCartao: string;
  cartoes: CartaoDoCliente[];
  sorteios: SorteioDoCliente[];
  premios: PremioDoCliente[];
  notificacoes: NotificacaoDoCliente[];
  notificacoesNaoLidas: number;
}
