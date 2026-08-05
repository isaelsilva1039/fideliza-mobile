import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { Empresa, Sessao, Usuario } from "../services/contrato";

/**
 * A sessão.
 *
 * Guardada no SecureStore — Keychain no iOS, Keystore no Android — e não em
 * `AsyncStorage`: enquanto a identidade do usuário é o que autoriza as
 * requisições, ela vale tanto quanto uma senha. Num aparelho com root, o
 * `AsyncStorage` é um arquivo de texto.
 *
 * O que persiste é só o suficiente para reabrir o app sem novo login. A lista de
 * empresas persiste junto porque o seletor do topo precisa dela antes da
 * primeira resposta da rede — abrir o app offline mostrando "nenhuma empresa"
 * seria pior que mostrar a lista de ontem.
 */

const CHAVE = "fideliza.mobile.sessao";

/**
 * O SecureStore do iOS recusa valores acima de ~2 KB em algumas versões, e a
 * sessão inteira com muitas empresas passa disso. Persistimos a sessão enxuta e
 * remontamos o resto da rede.
 */
interface SessaoPersistida {
  usuario: Usuario;
  empresaAtivaId: string;
  empresas: Array<Pick<Empresa, "id" | "nomeFantasia" | "situacao">>;
}

export interface EstadoSessao {
  session: Sessao | null;
  /** `false` até o SecureStore responder. Evita piscar a tela de login. */
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setSession: (sessao: Sessao) => Promise<void>;
  /** Troca a empresa ativa. As chaves de consulta mudam e tudo recarrega. */
  setEmpresaAtiva: (empresaId: string) => Promise<void>;
  /**
   * Registra uma empresa recém-criada na sessão local.
   *
   * O backend já vincula quem criou, mas a sessão no aparelho é a do login e não
   * sabe disso. Sem isso, a empresa nova aparece no seletor e não abre: só
   * entraria depois de sair e entrar de novo.
   */
  concederEmpresa: (empresa: Empresa) => Promise<void>;
  clear: () => Promise<void>;
}

/** Escreve sem deixar o app cair quando o SecureStore recusa. */
async function persistir(sessao: Sessao | null): Promise<void> {
  try {
    if (!sessao) {
      await SecureStore.deleteItemAsync(CHAVE);
      return;
    }

    const enxuta: SessaoPersistida = {
      usuario: sessao.usuario,
      empresaAtivaId: sessao.empresaAtivaId,
      empresas: sessao.empresas.map((e) => ({
        id: e.id,
        nomeFantasia: e.nomeFantasia,
        situacao: e.situacao,
      })),
    };

    await SecureStore.setItemAsync(CHAVE, JSON.stringify(enxuta));
  } catch {
    /*
     * Falha ao gravar não pode derrubar o login: a sessão em memória continua
     * válida e o usuário trabalha normalmente até fechar o app. Perder a
     * persistência custa um login novo; lançar aqui custaria a sessão inteira.
     */
  }
}

export const useSession = create<EstadoSessao>((set, get) => ({
  session: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const bruto = await SecureStore.getItemAsync(CHAVE);
      if (!bruto) {
        set({ session: null, hydrated: true });
        return;
      }

      const persistida = JSON.parse(bruto) as SessaoPersistida;

      set({
        session: {
          usuario: persistida.usuario,
          empresaAtivaId: persistida.empresaAtivaId,
          // As empresas voltam parciais; a consulta de empresas completa depois.
          empresas: persistida.empresas as Empresa[],
        },
        hydrated: true,
      });
    } catch {
      // Sessão corrompida (formato antigo, escrita interrompida): começa limpa.
      await persistir(null);
      set({ session: null, hydrated: true });
    }
  },

  setSession: async (sessao) => {
    await persistir(sessao);
    set({ session: sessao });
  },

  setEmpresaAtiva: async (empresaId) => {
    const atual = get().session;
    if (!atual || atual.empresaAtivaId === empresaId) return;

    const proxima: Sessao = { ...atual, empresaAtivaId: empresaId };
    await persistir(proxima);
    set({ session: proxima });
  },

  concederEmpresa: async (empresa) => {
    const atual = get().session;
    if (!atual) return;

    const jaTem = atual.empresas.some((e) => e.id === empresa.id);
    const proxima: Sessao = {
      ...atual,
      usuario: {
        ...atual.usuario,
        empresaIds: atual.usuario.empresaIds.includes(empresa.id)
          ? atual.usuario.empresaIds
          : [...atual.usuario.empresaIds, empresa.id],
      },
      empresas: jaTem ? atual.empresas : [...atual.empresas, empresa],
    };

    await persistir(proxima);
    set({ session: proxima });
  },

  clear: async () => {
    await persistir(null);
    set({ session: null });
  },
}));

/* -------------------------------------------------------------------------- */
/* Seletores                                                                  */
/* -------------------------------------------------------------------------- */

/** O usuário logado, ou `null`. */
export const useUsuario = () => useSession((estado) => estado.session?.usuario ?? null);

/**
 * A empresa ativa. Devolve `""` quando não há sessão, e não `undefined`, porque
 * é isso que entra nas chaves de consulta — e `undefined` numa chave faria o
 * TanStack Query tratar duas consultas diferentes como a mesma.
 */
export const useEmpresaAtivaId = () => useSession((estado) => estado.session?.empresaAtivaId ?? "");

export const useEmpresas = () => useSession((estado) => estado.session?.empresas ?? []);
