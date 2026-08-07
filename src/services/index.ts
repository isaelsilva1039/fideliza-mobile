import { api, montarQuery } from "../lib/api/client";
import type * as c from "./contrato";

/**
 * A camada de serviços.
 *
 * É o único lugar do app que conhece as URLs da API. As telas chamam estas
 * funções e recebem os tipos de `contrato.ts`; nenhuma tela monta caminho nem
 * conhece nome de parâmetro de query.
 *
 * A empresa ativa **não** viaja como parâmetro: vai no cabeçalho `X-Empresa-Id`,
 * montado pelo cliente HTTP a partir da sessão. As funções que recebem
 * `empresaId` o fazem apenas porque é ele que compõe a chave de cache do hook —
 * é o que faz trocar de empresa recarregar tudo.
 */

/* -------------------------------------------------------------------------- */
/* Entrada                                                                    */
/* -------------------------------------------------------------------------- */

export function entrar(email: string, senha: string): Promise<c.Sessao> {
  return api.post<c.Sessao>("/api/auth/login", { email, senha });
}

/** Confirma que a sessão ainda vale. O app chama ao abrir. */
export function revalidar(): Promise<c.Sessao> {
  return api.post<c.Sessao>("/api/auth/sessao");
}

export function sair(): Promise<void> {
  return api.post<void>("/api/auth/logout");
}

/* -------------------------------------------------------------------------- */
/* Empresas                                                                   */
/* -------------------------------------------------------------------------- */

/** As empresas que o usuário alcança. */
export function listarEmpresas(): Promise<c.Empresa[]> {
  return api.get<c.Empresa[]>("/api/empresas");
}

/** Todas as empresas da plataforma — só o dono enxerga. */
export function listarTodasEmpresas(): Promise<c.Empresa[]> {
  return api.get<c.Empresa[]>(`/api/empresas${montarQuery({ todas: true })}`);
}

export interface NovaEmpresa {
  nomeFantasia: string;
  razaoSocial?: string;
  documento: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  uf?: string;
}

export function criarEmpresa(entrada: NovaEmpresa): Promise<c.Empresa> {
  return api.post<c.Empresa>("/api/empresas", entrada);
}

export interface EdicaoEmpresa {
  nomeFantasia?: string;
  razaoSocial?: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  situacao?: c.SituacaoEmpresa;
}

export function editarEmpresa(id: string, entrada: EdicaoEmpresa): Promise<c.Empresa> {
  return api.patch<c.Empresa>(`/api/empresas/${id}`, entrada);
}

/* -------------------------------------------------------------------------- */
/* Configurações                                                              */
/* -------------------------------------------------------------------------- */

export function obterConfiguracao(): Promise<c.Configuracao> {
  return api.get<c.Configuracao>("/api/configuracoes");
}

export function salvarConfiguracao(entrada: c.Configuracao): Promise<c.Configuracao> {
  return api.put<c.Configuracao>("/api/configuracoes", entrada);
}

/* -------------------------------------------------------------------------- */
/* Início                                                                     */
/* -------------------------------------------------------------------------- */

export function obterInicio(dias: number): Promise<c.ResumoInicio> {
  return api.get<c.ResumoInicio>(`/api/inicio${montarQuery({ dias })}`);
}

/* -------------------------------------------------------------------------- */
/* Campanhas                                                                  */
/* -------------------------------------------------------------------------- */

export interface FiltroCampanhas {
  busca?: string;
  situacao?: c.SituacaoCampanha[];
  tipo?: c.TipoCampanha[];
  pagina?: number;
  tamanho?: number;
}

export function listarCampanhas(filtro: FiltroCampanhas = {}): Promise<c.Pagina<c.Campanha>> {
  return api.get<c.Pagina<c.Campanha>>(`/api/campanhas${montarQuery({ ...filtro })}`);
}

export function obterCampanha(id: string): Promise<c.DetalheCampanha> {
  return api.get<c.DetalheCampanha>(`/api/campanhas/${id}`);
}

export interface FiltroParticipantes {
  busca?: string;
  quaseCompletando?: boolean;
  pagina?: number;
  tamanho?: number;
}

export function listarParticipantes(
  campanhaId: string,
  filtro: FiltroParticipantes = {},
): Promise<c.Pagina<c.Participante>> {
  return api.get<c.Pagina<c.Participante>>(
    `/api/campanhas/${campanhaId}/participantes${montarQuery({ ...filtro })}`,
  );
}

/**
 * O corpo que cria ou edita campanha.
 *
 * `publicar` decide se a campanha nasce no ar ou como rascunho — o servidor não
 * aceita `situacao` na criação, justamente para não haver dois caminhos para o
 * mesmo estado.
 *
 * Valores em centavos: `valorMinimoCompra` e `valorPorCupom`.
 */
export interface NovaCampanha {
  nome: string;
  descricao: string;
  tipo: c.TipoCampanha;
  iniciaEm: string;
  terminaEm: string;
  sorteiaEm?: string;
  valorMinimoCompra?: number;
  selosNecessarios?: number;
  valorPorCupom?: number;
  quantidadeGanhadores?: number;
  limiteTotalCupons?: number;
  limiteDiarioCliente?: number;
  nomePremio: string;
  descricaoPremio?: string;
  quantidadePremio?: number;
  instrucoesRetirada?: string;
  funcionarioPodePublicar?: boolean;
  funcionarioPodePausar?: boolean;
  funcionarioPodeEncerrar?: boolean;
  funcionarioPodeSortear?: boolean;
  publicar: boolean;
}

export function criarCampanha(entrada: NovaCampanha): Promise<c.Campanha> {
  return api.post<c.Campanha>("/api/campanhas", entrada);
}

export function editarCampanha(
  id: string,
  entrada: Partial<NovaCampanha>,
): Promise<c.Campanha> {
  return api.patch<c.Campanha>(`/api/campanhas/${id}`, entrada);
}

export function alterarSituacaoCampanha(
  id: string,
  situacao: c.SituacaoCampanha,
): Promise<c.Campanha> {
  return api.patch<c.Campanha>(`/api/campanhas/${id}`, { situacao });
}

export function excluirCampanha(id: string): Promise<void> {
  return api.delete<void>(`/api/campanhas/${id}`);
}

export function sortear(campanhaId: string): Promise<c.Sorteio> {
  return api.post<c.Sorteio>(`/api/campanhas/${campanhaId}/sorteio`);
}

/* -------------------------------------------------------------------------- */
/* Clientes                                                                   */
/* -------------------------------------------------------------------------- */

export interface FiltroClientes {
  busca?: string;
  situacao?: c.SituacaoCliente;
  codigoCartao?: string;
  pagina?: number;
  tamanho?: number;
}

export function listarClientes(filtro: FiltroClientes = {}): Promise<c.Pagina<c.Cliente>> {
  return api.get<c.Pagina<c.Cliente>>(`/api/clientes${montarQuery({ ...filtro })}`);
}

/** A ficha completa: cadastro, cartões, sorteios, compras e prêmios. */
export function obterFichaCliente(id: string): Promise<c.FichaCliente> {
  return api.get<c.FichaCliente>(`/api/clientes/${id}`);
}

export interface NovoCliente {
  nome: string;
  documento: string;
  telefone: string;
  email?: string;
  vetorFacial?: number[];
  consentimentoFacial?: boolean;
}

export function criarCliente(entrada: NovoCliente): Promise<c.Cliente> {
  return api.post<c.Cliente>("/api/clientes", entrada);
}

export interface EdicaoCliente {
  nome?: string;
  telefone?: string;
  email?: string;
  situacao?: c.SituacaoCliente;
}

export function editarCliente(id: string, entrada: EdicaoCliente): Promise<c.Cliente> {
  return api.patch<c.Cliente>(`/api/clientes/${id}`, entrada);
}

export function reconhecerClientePorRosto(
  vetor: number[],
): Promise<{ clienteId: string; similaridade: number }> {
  return api.post<{ clienteId: string; similaridade: number }>(
    "/api/clientes/reconhecer-rosto",
    { vetor },
  );
}

/* -------------------------------------------------------------------------- */
/* Lançamentos                                                                */
/* -------------------------------------------------------------------------- */

export interface NovaCompra {
  campanhaId: string;
  clienteId?: string;
  codigoCliente?: string;
  /** Centavos. O servidor valida `@Positive`, então zero é recusado. */
  valorCompra: number;
}

export function registrarCompra(entrada: NovaCompra): Promise<c.ResultadoCompra> {
  return api.post<c.ResultadoCompra>("/api/lancamentos", entrada);
}

export function cancelarLancamento(id: string, motivo: string): Promise<c.Lancamento> {
  return api.patch<c.Lancamento>(`/api/lancamentos/${id}/cancelar`, { motivo });
}

/* -------------------------------------------------------------------------- */
/* Entregas                                                                   */
/* -------------------------------------------------------------------------- */

export interface FiltroEntregas {
  busca?: string;
  situacao?: c.SituacaoEntrega[];
  pagina?: number;
  tamanho?: number;
}

export function listarEntregas(filtro: FiltroEntregas = {}): Promise<c.Pagina<c.Entrega>> {
  return api.get<c.Pagina<c.Entrega>>(`/api/entregas${montarQuery({ ...filtro })}`);
}

export interface BaixaEntrega {
  codigo?: string;
  documentoConferido?: string;
  entregarParaTerceiro?: boolean;
  recebedorNome?: string;
  recebedorDocumento?: string;
  observacao?: string;
}

/** Baixa a entrega. Responde 204 — sem corpo. */
export function entregar(id: string, entrada: BaixaEntrega): Promise<void> {
  return api.patch<void>(`/api/entregas/${id}/entregar`, entrada);
}

export function cancelarEntrega(id: string, observacao?: string): Promise<void> {
  return api.patch<void>(`/api/entregas/${id}/cancelar`, { observacao });
}

/* -------------------------------------------------------------------------- */
/* Equipe                                                                     */
/* -------------------------------------------------------------------------- */

export function listarEquipe(): Promise<c.Membro[]> {
  return api.get<c.Membro[]>("/api/equipe");
}

export interface NovoMembro {
  nome: string;
  email: string;
  telefone?: string;
  perfil: "ADMINISTRADOR" | "FUNCIONARIO";
}

export function criarMembro(entrada: NovoMembro): Promise<c.Usuario> {
  return api.post<c.Usuario>("/api/equipe", entrada);
}

export interface EdicaoMembro {
  nome?: string;
  telefone?: string;
  perfil?: c.Perfil;
  situacao?: c.SituacaoUsuario;
}

export function editarMembro(id: string, entrada: EdicaoMembro): Promise<c.Usuario> {
  return api.patch<c.Usuario>(`/api/equipe/${id}`, entrada);
}

/* -------------------------------------------------------------------------- */
/* Auditoria                                                                  */
/* -------------------------------------------------------------------------- */

export interface FiltroAuditoria {
  dias?: number;
  funcionario?: string;
  apenasMarcados?: boolean;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

export function obterAuditoria(filtro: FiltroAuditoria = {}): Promise<c.RelatorioAuditoria> {
  return api.get<c.RelatorioAuditoria>(`/api/auditoria${montarQuery({ ...filtro })}`);
}

/* -------------------------------------------------------------------------- */
/* Portal do cliente                                                          */
/* -------------------------------------------------------------------------- */

/**
 * As duas rotas públicas: pedir o código e conferi-lo.
 *
 * Não exigem sessão — quem chega aqui é o consumidor, no próprio celular. O
 * documento identifica, mas não autentica; o código enviado ao telefone é o que
 * autentica.
 */
export function pedirCodigo(documento: string): Promise<c.PedidoDeCodigo> {
  return api.post<c.PedidoDeCodigo>("/api/portal/codigo", { documento });
}

export function consultarPortal(pedidoId: string, codigo: string): Promise<c.CartaoDoPortal> {
  return api.post<c.CartaoDoPortal>("/api/portal/consulta", { pedidoId, codigo });
}

export type ResultadoPortalFacial =
  | { cartao: c.CartaoDoPortal; pedidoCodigo?: never }
  | { cartao?: never; pedidoCodigo: c.PedidoDeCodigo };

export function consultarPortalPorRosto(vetor: number[]): Promise<ResultadoPortalFacial> {
  return api.post<ResultadoPortalFacial>("/api/portal/rosto", { vetor });
}

export function listarNotificacoesPortal(
  pedidoId: string,
): Promise<c.NotificacaoDoCliente[]> {
  return api.post<c.NotificacaoDoCliente[]>("/api/portal/notificacoes", { pedidoId });
}

export function marcarNotificacaoPortalComoLida(
  pedidoId: string,
  notificacaoId: string,
): Promise<c.NotificacaoDoCliente> {
  return api.patch<c.NotificacaoDoCliente>(
    `/api/portal/notificacoes/${notificacaoId}/lida`,
    { pedidoId },
  );
}
