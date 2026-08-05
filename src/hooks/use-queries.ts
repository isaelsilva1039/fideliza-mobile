import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { mensagemDoErro } from "../lib/api/errors";
import * as servico from "../services";
import type * as c from "../services/contrato";
import { avisar } from "../stores/avisos";
import { useEmpresaAtivaId, useSession } from "../stores/session";

/**
 * Os hooks de dados.
 *
 * Duas convenções sustentam o resto, as mesmas do painel web:
 *
 * 1. **Toda chave de consulta começa pela empresa ativa.** Trocar de empresa
 *    troca a chave, e o TanStack Query busca de novo sozinho — não é preciso
 *    invalidar nada na mão nem lembrar de limpar cache. É o que faz o seletor do
 *    topo funcionar de verdade.
 *
 * 2. **Mutação que dá certo avisa e invalida a empresa inteira.** As coleções são
 *    pequenas e se influenciam (registrar compra mexe em campanha, cliente,
 *    cartão e entrega); invalidar cirurgicamente daria telas desatualizadas por
 *    uma economia irrelevante.
 */

const chaves = {
  empresa: (empresaId: string) => [empresaId] as const,
  inicio: (empresaId: string, dias: number) => [empresaId, "inicio", dias] as const,
  campanhas: (empresaId: string, filtro: unknown) =>
    [empresaId, "campanhas", filtro] as const,
  campanha: (empresaId: string, id: string) => [empresaId, "campanha", id] as const,
  participantes: (empresaId: string, id: string, filtro: unknown) =>
    [empresaId, "campanha", id, "participantes", filtro] as const,
  clientes: (empresaId: string, filtro: unknown) => [empresaId, "clientes", filtro] as const,
  cliente: (empresaId: string, id: string) => [empresaId, "cliente", id] as const,
  entregas: (empresaId: string, filtro: unknown) => [empresaId, "entregas", filtro] as const,
  equipe: (empresaId: string) => [empresaId, "equipe"] as const,
  auditoria: (empresaId: string, filtro: unknown) =>
    [empresaId, "auditoria", filtro] as const,
  configuracao: (empresaId: string) => [empresaId, "configuracao"] as const,
  /** Fora da empresa ativa: a lista de empresas não pertence a nenhuma delas. */
  empresas: () => ["empresas"] as const,
  todasEmpresas: () => ["empresas", "todas"] as const,
};

/* -------------------------------------------------------------------------- */
/* Consultas                                                                  */
/* -------------------------------------------------------------------------- */

export function useInicio(dias: number) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.inicio(empresaId, dias),
    queryFn: () => servico.obterInicio(dias),
    enabled: Boolean(empresaId),
  });
}

export function useCampanhas(filtro: servico.FiltroCampanhas = {}) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.campanhas(empresaId, filtro),
    queryFn: () => servico.listarCampanhas(filtro),
    enabled: Boolean(empresaId),
    // Mantém a página anterior visível enquanto a próxima carrega, para a lista
    // não colapsar a cada toque na paginação.
    placeholderData: (anterior) => anterior,
  });
}

export function useCampanha(id: string) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.campanha(empresaId, id),
    queryFn: () => servico.obterCampanha(id),
    enabled: Boolean(empresaId && id),
  });
}

export function useParticipantes(id: string, filtro: servico.FiltroParticipantes = {}) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.participantes(empresaId, id, filtro),
    queryFn: () => servico.listarParticipantes(id, filtro),
    enabled: Boolean(empresaId && id),
    placeholderData: (anterior) => anterior,
  });
}

export function useClientes(filtro: servico.FiltroClientes = {}) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.clientes(empresaId, filtro),
    queryFn: () => servico.listarClientes(filtro),
    enabled: Boolean(empresaId),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaCliente(id: string) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.cliente(empresaId, id),
    queryFn: () => servico.obterFichaCliente(id),
    enabled: Boolean(empresaId && id),
  });
}

export function useEntregas(filtro: servico.FiltroEntregas = {}) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.entregas(empresaId, filtro),
    queryFn: () => servico.listarEntregas(filtro),
    enabled: Boolean(empresaId),
    placeholderData: (anterior) => anterior,
  });
}

export function useEquipe() {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.equipe(empresaId),
    queryFn: servico.listarEquipe,
    enabled: Boolean(empresaId),
  });
}

export function useAuditoria(filtro: servico.FiltroAuditoria = {}) {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.auditoria(empresaId, filtro),
    queryFn: () => servico.obterAuditoria(filtro),
    enabled: Boolean(empresaId),
    placeholderData: (anterior) => anterior,
  });
}

export function useConfiguracao() {
  const empresaId = useEmpresaAtivaId();

  return useQuery({
    queryKey: chaves.configuracao(empresaId),
    queryFn: servico.obterConfiguracao,
    enabled: Boolean(empresaId),
  });
}

export function useEmpresasDoUsuario() {
  const temSessao = useSession((estado) => Boolean(estado.session));

  return useQuery({
    queryKey: chaves.empresas(),
    queryFn: servico.listarEmpresas,
    enabled: temSessao,
    // A lista de empresas do usuário praticamente não muda durante o uso.
    staleTime: 10 * 60_000,
  });
}

/** Todas as empresas da plataforma — tela do dono. */
export function useTodasEmpresas(habilitado: boolean) {
  return useQuery({
    queryKey: chaves.todasEmpresas(),
    queryFn: servico.listarTodasEmpresas,
    enabled: habilitado,
  });
}

/* -------------------------------------------------------------------------- */
/* Mutações                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Base das mutações: recarrega os dados da empresa e avisa o usuário.
 *
 * O aviso de erro sai daqui para que nenhuma tela esqueça de tratar a falha — o
 * pior resultado possível é o botão parar de girar e nada acontecer.
 */
function useMutacao<TDado, TEntrada>(
  mutationFn: (entrada: TEntrada) => Promise<TDado>,
  opcoes: {
    sucesso?: string | ((dado: TDado, entrada: TEntrada) => string);
    aoConcluir?: (dado: TDado, entrada: TEntrada) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  const empresaId = useEmpresaAtivaId();

  const config: UseMutationOptions<TDado, Error, TEntrada> = {
    mutationFn,
    onSuccess: (dado, entrada) => {
      void queryClient.invalidateQueries({ queryKey: chaves.empresa(empresaId) });

      const texto =
        typeof opcoes.sucesso === "function" ? opcoes.sucesso(dado, entrada) : opcoes.sucesso;
      if (texto) avisar.sucesso(texto);

      opcoes.aoConcluir?.(dado, entrada);
    },
    onError: (erro) => avisar.erro(mensagemDoErro(erro)),
  };

  return useMutation(config);
}

/* Campanhas --------------------------------------------------------------- */

export function useCriarCampanha(aoCriar?: (id: string) => void) {
  return useMutacao(servico.criarCampanha, {
    sucesso: (campanha) =>
      campanha.situacao === "ATIVA"
        ? `"${campanha.nome}" está no ar.`
        : `"${campanha.nome}" salva como rascunho.`,
    aoConcluir: (campanha) => aoCriar?.(campanha.id),
  });
}

export function useEditarCampanha(aoSalvar?: () => void) {
  return useMutacao(
    (entrada: { id: string } & Partial<servico.NovaCampanha>) =>
      servico.editarCampanha(entrada.id, entrada),
    { sucesso: "Alterações salvas.", aoConcluir: () => aoSalvar?.() },
  );
}

export function useAlterarSituacaoCampanha() {
  return useMutacao(
    (entrada: { id: string; situacao: c.SituacaoCampanha }) =>
      servico.alterarSituacaoCampanha(entrada.id, entrada.situacao),
    {
      sucesso: (campanha) => {
        switch (campanha.situacao) {
          case "ATIVA":
            return `"${campanha.nome}" está no ar.`;
          case "PAUSADA":
            return `"${campanha.nome}" foi pausada.`;
          case "ENCERRADA":
            return `"${campanha.nome}" foi encerrada.`;
          default:
            return "Campanha atualizada.";
        }
      },
    },
  );
}

export function useExcluirCampanha(aoExcluir?: () => void) {
  return useMutacao((id: string) => servico.excluirCampanha(id), {
    sucesso: "Campanha excluída.",
    aoConcluir: () => aoExcluir?.(),
  });
}

export function useSortear(aoSortear?: (sorteio: c.Sorteio) => void) {
  return useMutacao((id: string) => servico.sortear(id), {
    sucesso: (sorteio) =>
      sorteio.ganhadores.length === 1
        ? `Ganhador: ${sorteio.ganhadores[0].nome}.`
        : `${sorteio.ganhadores.length} ganhadores sorteados.`,
    aoConcluir: (sorteio) => aoSortear?.(sorteio),
  });
}

/* Clientes ---------------------------------------------------------------- */

export function useCriarCliente(aoCriar?: (cliente: c.Cliente) => void) {
  return useMutacao(servico.criarCliente, {
    sucesso: (cliente) => `${cliente.nome} foi cadastrado.`,
    aoConcluir: (cliente) => aoCriar?.(cliente),
  });
}

export function useEditarCliente(aoSalvar?: () => void) {
  return useMutacao(
    (entrada: { id: string } & servico.EdicaoCliente) =>
      servico.editarCliente(entrada.id, entrada),
    { sucesso: "Cadastro atualizado.", aoConcluir: () => aoSalvar?.() },
  );
}

/* Compras ----------------------------------------------------------------- */

export function useRegistrarCompra(aoConcluir?: (r: c.ResultadoCompra) => void) {
  return useMutacao(servico.registrarCompra, {
    // A frase vem pronta do servidor — sai do mesmo lugar que decidiu o que
    // aconteceu, então nunca discorda do efeito real.
    sucesso: (resultado) => resultado.mensagem,
    aoConcluir: (resultado) => aoConcluir?.(resultado),
  });
}

export function useCancelarLancamento() {
  return useMutacao(
    (entrada: { id: string; motivo: string }) =>
      servico.cancelarLancamento(entrada.id, entrada.motivo),
    { sucesso: "Compra cancelada e benefício removido." },
  );
}

/* Entregas ---------------------------------------------------------------- */

export function useEntregar() {
  return useMutacao(
    (entrada: { id: string; codigo?: string; observacao?: string }) =>
      servico.entregar(entrada.id, entrada),
    { sucesso: "Prêmio entregue." },
  );
}

export function useCancelarEntrega() {
  return useMutacao(
    (entrada: { id: string; observacao?: string }) =>
      servico.cancelarEntrega(entrada.id, entrada.observacao),
    { sucesso: "Entrega cancelada e prêmio devolvido ao estoque." },
  );
}

/* Equipe ------------------------------------------------------------------ */

export function useCriarMembro(aoCriar?: () => void) {
  return useMutacao(servico.criarMembro, {
    sucesso: (usuario) => `${usuario.nome} foi cadastrado.`,
    aoConcluir: () => aoCriar?.(),
  });
}

export function useEditarMembro(aoSalvar?: () => void) {
  return useMutacao(
    (entrada: { id: string } & servico.EdicaoMembro) =>
      servico.editarMembro(entrada.id, entrada),
    {
      sucesso: (usuario) =>
        usuario.situacao === "INATIVO"
          ? `${usuario.nome} perdeu o acesso.`
          : "Alterações salvas.",
      aoConcluir: () => aoSalvar?.(),
    },
  );
}

/* Empresas ---------------------------------------------------------------- */

export function useCriarEmpresa(aoCriar?: () => void) {
  const queryClient = useQueryClient();
  const concederEmpresa = useSession((estado) => estado.concederEmpresa);

  return useMutacao(servico.criarEmpresa, {
    sucesso: (empresa) => `${empresa.nomeFantasia} foi cadastrada.`,
    aoConcluir: (empresa) => {
      /*
       * O backend já vincula quem criou à empresa nova, mas a sessão no aparelho
       * é a do login e não sabe disso. Sem registrar aqui, a empresa aparece no
       * seletor e não abre: quem acabou de criá-la só entraria depois de sair e
       * entrar de novo.
       */
      void concederEmpresa(empresa);
      void queryClient.invalidateQueries({ queryKey: chaves.empresas() });
      aoCriar?.();
    },
  });
}

export function useEditarEmpresa(aoSalvar?: () => void) {
  const queryClient = useQueryClient();

  return useMutacao(
    (entrada: { id: string } & servico.EdicaoEmpresa) =>
      servico.editarEmpresa(entrada.id, entrada),
    {
      sucesso: (empresa) =>
        empresa.situacao === "INATIVA"
          ? `${empresa.nomeFantasia} foi desativada.`
          : "Dados da empresa salvos.",
      // A lista de empresas tem chave própria, fora da empresa ativa.
      aoConcluir: () => {
        void queryClient.invalidateQueries({ queryKey: chaves.empresas() });
        aoSalvar?.();
      },
    },
  );
}

/* Configurações ----------------------------------------------------------- */

export function useSalvarConfiguracao() {
  return useMutacao(servico.salvarConfiguracao, { sucesso: "Configurações salvas." });
}
