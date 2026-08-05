import { NativeModules, Platform } from "react-native";
import { useSession } from "../stores/session";

const API_PORT = 8080;
// Hosts que só resolvem dentro da própria máquina ou do emulador Android.
const SOMENTE_LOCAL = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/;
const hostDe = (url: string | undefined) => url?.match(/^https?:\/\/([^/:]+)/)?.[1];

// O bundle Metro vem da máquina que roda `expo start`, que em dev é a mesma que serve a API.
// Reaproveitar esse host acerta em todo alvo: 10.0.2.2 no emulador Android e o IP da LAN num aparelho físico.
const hostMetro = hostDe(NativeModules?.SourceCode?.getConstants?.().scriptURL);

// EXPO_PUBLIC_API_URL manda, exceto quando aponta para um host só-local: aí o host do Metro
// vence, senão um aparelho físico (iOS/Android) nunca alcançaria a API.
const configurado = process.env.EXPO_PUBLIC_API_URL;
const usarConfigurado = configurado && !(hostMetro && SOMENTE_LOCAL.test(hostDe(configurado) ?? ""));
const API_URL = usarConfigurado
  ? configurado
  : hostMetro
    ? `http://${hostMetro}:${API_PORT}`
    : Platform.select({ android: `http://10.0.2.2:${API_PORT}`, default: `http://localhost:${API_PORT}` })!;

export class ApiError extends Error {}
export type Role = "DONO" | "ADMINISTRADOR" | "FUNCIONARIO";
export interface Session { usuario: { id: string; nome: string; email: string; perfil: Role; empresaIds: string[]; situacao: "ATIVO" | "INATIVO" }; empresaAtivaId: string; empresas: Array<{ id: string; nomeFantasia: string; razaoSocial: string; documento: string; situacao: "ATIVA" | "INATIVA"; criadoEm: string }>; }
export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }
export interface PortalData { firstName: string; companyName: string; cardCode: string; cards: Array<{ campaignId: string; campaignName: string; prizeName: string; currentStamps: number; requiredStamps: number }>; raffles: Array<{ campaignId: string; campaignName: string; prizeName: string; coupons: number }>; prizes: Array<{ id: string; prizeName: string; pickupInstructions?: string }>; }
export interface Home { movimento: { valor: number }; clientesQueCompraram: { valor: number }; beneficiosEntregues: { valor: number }; campanhasNoAr: number; clientesInativos: number; entregasPendentes: Array<{ id: string; cliente: string; premio: string }>; }
export interface Campaign { id: string; nome: string; descricao: string; tipo: "CARTAO_FIDELIDADE" | "SORTEIO"; situacao: string; iniciaEm: string; terminaEm: string; sorteiaEm?: string; regraEmUmaFrase: string; totalParticipantes: number; premio?: { nome: string }; podeSortear: boolean; funcionarioPodePublicar: boolean; funcionarioPodePausar: boolean; funcionarioPodeEncerrar: boolean; funcionarioPodeSortear: boolean; proximasSituacoes: string[]; }
export interface Customer { id: string; nome: string; documento: string; codigoCartao: string; telefone: string; email?: string; situacao: string; totalGasto: number; }
export interface Member { usuario: { id: string; nome: string; email: string; telefone?: string; perfil: Role; situacao: string }; lancamentosNoMes: number; }
export interface Delivery { id: string; codigo: string; situacao: string; cliente: string; telefoneCliente: string; campanha: string; premio: string; instrucoesRetirada?: string; }
export interface Settings { avisarCliente: boolean; bloquearProprioCpf: boolean; bloquearDuplicados: boolean; }
export interface Tenant { id: string; nomeFantasia: string; razaoSocial: string; documento: string; situacao: string; telefone?: string; email?: string; cidade?: string; uf?: string; }
export interface Audit { janelaEmDias: number; resumo: Array<{ usuarioId: string; nome: string; perfil: Role; confirmados: number; cancelados: number; valorTotal: number; clientesDistintos: number; sinais: Array<{ rotulo: string; detalhe: string; gravidade: string }> }>; linhas: Page<{ lancamento: { id: string; codigo: string; valorCompra: number; situacao: string; criadoEm: string }; usuario: string; cliente: string; campanha: string; marcas: string[] }>; }

type LoginResponse = Session;
type PortalCodeResponse = { pedidoId: string; finalDoTelefone: string; codigoDemonstracao?: string };
type PortalResponse = { primeiroNome: string; empresa: string; codigoCartao: string; cartoes: Array<{ campanhaId: string; campanha: string; premio: string; selosAtuais: number; selosNecessarios: number }>; sorteios: Array<{ campanhaId: string; campanha: string; premio: string; cupons: number }>; premios: Array<{ id: string; premio: string; instrucoesRetirada?: string }> };

const params = (value: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams(); Object.entries(value).forEach(([key, item]) => { if (item !== undefined && item !== "") search.append(key, String(item)); });
  const query = search.toString(); return query ? `?${query}` : "";
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = useSession.getState().session;
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(session ? { "X-Usuario-Id": session.usuario.id, "X-Empresa-Id": session.empresaAtivaId } : {}), ...init?.headers } }); }
  catch { throw new ApiError(`Não foi possível alcançar a API em ${API_URL}.`); }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new ApiError(body.mensagem ?? body.message ?? "A operação não pôde ser concluída."); }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}
const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const api = {
  login: (email: string, senha: string): Promise<Session> => request<LoginResponse>("/api/auth/login", { method: "POST", ...json({ email, senha }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  getHome: () => request<Home>("/api/inicio?dias=30"),
  getCampaigns: (search = "") => request<Page<Campaign>>(`/api/campanhas${params({ busca: search, pagina: 1, tamanho: 30 })}`),
  createCampaign: (input: { nome: string; descricao: string; tipo: Campaign["tipo"]; iniciaEm: string; terminaEm: string; nomePremio: string; selosNecessarios?: number; valorPorCupom?: number; publicar: boolean }) => request<Campaign>("/api/campanhas", { method: "POST", ...json({ ...input, regra: input.tipo === "CARTAO_FIDELIDADE" ? { selosNecessarios: input.selosNecessarios ?? 10 } : { valorPorCupom: input.valorPorCupom ?? 1000, quantidadeGanhadores: 1 }, quantidadePremio: 1 }) }),
  updateCampaignStatus: (id: string, situacao: string) => request<Campaign>(`/api/campanhas/${id}`, { method: "PATCH", ...json({ situacao }) }),
  drawCampaign: (id: string) => request<{ ganhadores: Array<{ nome: string }> }>(`/api/campanhas/${id}/sorteio`, { method: "POST" }),
  getCustomers: (search = "") => request<Page<Customer>>(`/api/clientes${params({ busca: search, pagina: 1, tamanho: 30 })}`),
  createCustomer: (input: { nome: string; documento: string; telefone: string; email?: string }) => request<Customer>("/api/clientes", { method: "POST", ...json(input) }),
  updateCustomer: (id: string, input: Partial<Pick<Customer, "nome" | "telefone" | "email" | "situacao">>) => request<Customer>(`/api/clientes/${id}`, { method: "PATCH", ...json(input) }),
  getMembers: () => request<Member[]>("/api/equipe"),
  createMember: (input: { nome: string; email: string; telefone?: string; perfil: "ADMINISTRADOR" | "FUNCIONARIO" }) => request<Member["usuario"]>("/api/equipe", { method: "POST", ...json(input) }),
  updateMember: (id: string, input: { nome?: string; telefone?: string; perfil?: Role; situacao?: string }) => request<Member["usuario"]>(`/api/equipe/${id}`, { method: "PATCH", ...json(input) }),
  getDeliveries: () => request<Page<Delivery>>("/api/entregas?pagina=1&tamanho=30"),
  deliver: (id: string, codigo: string) => request<void>(`/api/entregas/${id}/entregar`, { method: "PATCH", ...json({ codigo }) }),
  getSettings: () => request<Settings>("/api/configuracoes"),
  updateSettings: (settings: Settings) => request<Settings>("/api/configuracoes", { method: "PUT", ...json(settings) }),
  getTenants: () => request<Tenant[]>("/api/empresas?todas=true"),
  createTenant: (input: { nomeFantasia: string; razaoSocial: string; documento: string; telefone?: string; email?: string; cidade?: string; uf?: string }) => request<Tenant>("/api/empresas", { method: "POST", ...json(input) }),
  updateTenant: (id: string, input: Partial<Tenant>) => request<Tenant>(`/api/empresas/${id}`, { method: "PATCH", ...json(input) }),
  getAudit: (days = 30) => request<Audit>(`/api/auditoria${params({ dias: days, pagina: 1, tamanho: 30 })}`),
  registerPurchase: (input: { campanhaId: string; clienteId: string; valorCompra: number }) => request<{ mensagem: string }>("/api/lancamentos", { method: "POST", ...json(input) }),
  cancelPurchase: (id: string, motivo: string) => request<void>(`/api/lancamentos/${id}/cancelar`, { method: "PATCH", ...json({ motivo }) }),
  cancelDelivery: (id: string, observacao?: string) => request<void>(`/api/entregas/${id}/cancelar`, { method: "PATCH", ...json({ observacao }) }),
  async requestPortalCode(documento: string) { const value = await request<PortalCodeResponse>("/api/portal/codigo", { method: "POST", ...json({ documento }) }); return { requestId: value.pedidoId, phoneHint: value.finalDoTelefone, demoCode: value.codigoDemonstracao }; },
  async openPortal(pedidoId: string, codigo: string): Promise<PortalData> { const value = await request<PortalResponse>("/api/portal/consulta", { method: "POST", ...json({ pedidoId, codigo }) }); return { firstName: value.primeiroNome, companyName: value.empresa, cardCode: value.codigoCartao, cards: value.cartoes.map((v) => ({ campaignId: v.campanhaId, campaignName: v.campanha, prizeName: v.premio, currentStamps: v.selosAtuais, requiredStamps: v.selosNecessarios })), raffles: value.sorteios.map((v) => ({ campaignId: v.campanhaId, campaignName: v.campanha, prizeName: v.premio, coupons: v.cupons })), prizes: value.premios.map((v) => ({ id: v.id, prizeName: v.premio, pickupInstructions: v.instrucoesRetirada })) }; },
};
