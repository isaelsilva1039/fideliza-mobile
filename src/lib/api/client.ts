import { NativeModules, Platform } from "react-native";

import { ApiError } from "./errors";

/**
 * Cliente HTTP único do aplicativo.
 *
 * A camada de serviços (`src/services`) chama estas funções; nenhuma tela chama
 * `fetch` direto. Aqui moram três coisas e nada mais: descobrir o endereço da
 * API, anexar a identidade de quem chama, e traduzir falha de rede ou status de
 * erro em `ApiError`.
 */

/* -------------------------------------------------------------------------- */
/* Endereço da API                                                            */
/* -------------------------------------------------------------------------- */

const API_PORT = 8080;

/** Hosts que só resolvem dentro da própria máquina ou do emulador Android. */
const SOMENTE_LOCAL = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/;

const hostDe = (url: string | undefined) => url?.match(/^https?:\/\/([^/:]+)/)?.[1];

/**
 * O host de onde veio o bundle.
 *
 * Em desenvolvimento o Metro roda na mesma máquina que serve a API, então esse
 * host acerta em todo alvo sem configuração: `10.0.2.2` no emulador Android e o
 * IP da rede local num aparelho físico, iOS ou Android.
 */
const hostMetro = hostDe(NativeModules?.SourceCode?.getConstants?.().scriptURL);

/**
 * `EXPO_PUBLIC_API_URL` manda, com uma exceção: quando aponta para um host
 * só-local, o host do Metro vence. Sem isso, um `.env` com `10.0.2.2` — que é o
 * padrão para emulador Android — deixaria todo aparelho físico sem alcançar a
 * API, e o sintoma seria "o app abre e não carrega nada".
 */
const configurado = process.env.EXPO_PUBLIC_API_URL;
const usarConfigurado = configurado && !(hostMetro && SOMENTE_LOCAL.test(hostDe(configurado) ?? ""));

export const API_URL = usarConfigurado
  ? configurado
  : hostMetro
    ? `http://${hostMetro}:${API_PORT}`
    : Platform.select({
        android: `http://10.0.2.2:${API_PORT}`,
        default: `http://localhost:${API_PORT}`,
      })!;

/* -------------------------------------------------------------------------- */
/* Identidade de quem chama                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Identidade da requisição.
 *
 * ⚠️ **Isto não é autenticação.** Enquanto o backend não emite token assinado, o
 * identificador do usuário e a empresa ativa viajam em cabeçalhos de texto —
 * qualquer pessoa com o endereço da API forja os dois e lê os dados de qualquer
 * empresa. Serve para desenvolvimento e só.
 *
 * **JWT é obrigatório antes de publicar o app.** Quando existir, só esta função
 * muda: passa a ler o token da sessão e a mandar `Authorization: Bearer`.
 *
 * A sessão é lida direto do store, não por hook, porque o cliente é chamado de
 * fora da árvore React — inclusive de dentro do TanStack Query.
 */
function cabecalhosDaSessao(): Record<string, string> {
  // `require` tardio, e não `import`: o store importa os tipos dos serviços, que
  // importam este arquivo. Em ciclo de import estático um dos lados chega vazio.
  const { useSession } = require("../../stores/session") as typeof import("../../stores/session");
  const { session } = useSession.getState();

  if (!session) return {};

  const cabecalhos: Record<string, string> = {};
  if (session.usuario.id) cabecalhos["X-Usuario-Id"] = session.usuario.id;
  if (session.empresaAtivaId) cabecalhos["X-Empresa-Id"] = session.empresaAtivaId;
  return cabecalhos;
}

/* -------------------------------------------------------------------------- */
/* Query string                                                               */
/* -------------------------------------------------------------------------- */

export type ValorDeQuery =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number>;

/**
 * Monta a query string ignorando filtro não preenchido, para a URL refletir só
 * o que o usuário realmente selecionou — e para a chave de cache do TanStack
 * Query não variar por causa de um campo vazio.
 */
export function montarQuery(params: Record<string, ValorDeQuery> = {}): string {
  const busca = new URLSearchParams();

  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === "") continue;

    if (Array.isArray(valor)) {
      // Array vazio não deve virar `chave=`, que o servidor leria como filtro.
      for (const item of valor) {
        if (item === "" || item === null || item === undefined) continue;
        busca.append(chave, String(item));
      }
      continue;
    }

    busca.set(chave, String(valor));
  }

  const query = busca.toString();
  return query ? `?${query}` : "";
}

/* -------------------------------------------------------------------------- */
/* Requisição                                                                 */
/* -------------------------------------------------------------------------- */

/** Corpo de erro devolvido pela API em Java. */
interface ErroDaApi {
  codigo?: string;
  mensagem?: string;
  errosPorCampo?: Record<string, string>;
}

async function comoApiError(resposta: Response): Promise<ApiError> {
  let corpo: ErroDaApi = {};
  try {
    corpo = (await resposta.json()) as ErroDaApi;
  } catch {
    // Resposta sem JSON (ex. 502 de proxy): cai no genérico por status.
  }

  if (corpo.mensagem) {
    return new ApiError(
      corpo.codigo ?? "SERVIDOR",
      corpo.mensagem,
      resposta.status,
      corpo.errosPorCampo,
    );
  }

  switch (resposta.status) {
    case 401:
      return ApiError.naoAutorizado();
    case 403:
      return ApiError.semPermissao();
    case 404:
      return ApiError.naoEncontrado();
    case 409:
      return ApiError.conflito();
    default:
      return ApiError.servidor();
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;

  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...cabecalhosDaSessao(),
        ...init?.headers,
      },
    });
  } catch {
    // `fetch` só rejeita quando a requisição não chegou ao servidor.
    throw ApiError.rede(API_URL);
  }

  if (!resposta.ok) throw await comoApiError(resposta);

  // 204 é a resposta das baixas (`entregar`, `cancelar`): sucesso sem corpo.
  if (resposta.status === 204) return undefined as T;

  /*
   * Corpo vazio com 2xx também é sucesso sem conteúdo.
   *
   * Nem toda rota que não devolve nada responde 204 — método `void` no Spring sai
   * como 200 com corpo vazio. Chamar `json()` nisso estoura "JSON Parse error",
   * que aparece na tela como se o cliente não tivesse sido salvo, quando foi.
   * Ler como texto primeiro custa nada e tira essa classe de erro do caminho.
   */
  const texto = await resposta.text();
  if (!texto) return undefined as T;

  return JSON.parse(texto) as T;
}

const comCorpo = (metodo: string) =>
  function <T>(caminho: string, corpo?: unknown, init?: RequestInit): Promise<T> {
    return requisitar<T>(caminho, {
      ...init,
      method: metodo,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  };

export const api = {
  get: <T>(caminho: string, init?: RequestInit) =>
    requisitar<T>(caminho, { ...init, method: "GET" }),
  post: comCorpo("POST"),
  put: comCorpo("PUT"),
  patch: comCorpo("PATCH"),
  delete: <T>(caminho: string, init?: RequestInit) =>
    requisitar<T>(caminho, { ...init, method: "DELETE" }),
};
