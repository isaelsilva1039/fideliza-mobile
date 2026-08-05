import type { Perfil } from "../services/contrato";

/**
 * Quem pode o quê.
 *
 * Mesma tabela do painel web, com os nomes de perfil da API. Os três perfis são
 * encaixados: o dono tem tudo, o administrador tem tudo menos criar empresa, o
 * funcionário atende o balcão. Subir de nível só acrescenta — ninguém troca um
 * poder por outro.
 *
 * Trabalho de balcão (registrar compra, entregar prêmio, consultar ficha) não
 * exige permissão nenhuma: é o uso normal do sistema, e os três perfis fazem.
 *
 * ⚠️ A checagem é de interface: esconde botão e item de menu. **Não substitui
 * autorização no servidor** — esconder um botão não impede uma requisição
 * forjada, e enquanto a identidade viaja em cabeçalho de texto forjar é trivial.
 */

export type Permissao =
  | "campanhas.gerenciar"
  | "campanhas.sortear"
  | "clientes.gerenciar"
  | "equipe.gerenciar"
  | "auditoria.ver"
  | "configuracoes.gerenciar"
  | "empresas.gerenciar";

/** Tudo que a empresa faz por si. O dono acrescenta `empresas.gerenciar`. */
const DA_EMPRESA: readonly Permissao[] = [
  "campanhas.gerenciar",
  "campanhas.sortear",
  "clientes.gerenciar",
  "equipe.gerenciar",
  "auditoria.ver",
  "configuracoes.gerenciar",
];

export const TODAS_AS_PERMISSOES: readonly Permissao[] = [...DA_EMPRESA, "empresas.gerenciar"];

export const ROTULO_PERMISSAO: Record<Permissao, string> = {
  "campanhas.gerenciar": "Criar e editar campanhas",
  "campanhas.sortear": "Realizar sorteios",
  "clientes.gerenciar": "Editar cadastro de clientes",
  "equipe.gerenciar": "Cadastrar e desativar a equipe",
  "auditoria.ver": "Ver os lançamentos e os sinais de alerta",
  "configuracoes.gerenciar": "Alterar configurações",
  "empresas.gerenciar": "Criar e desativar empresas",
};

const POR_PERFIL: Record<Perfil, readonly Permissao[]> = {
  // Pode tudo, e é o único que cria empresa.
  DONO: TODAS_AS_PERMISSOES,

  // Tudo dentro da própria empresa.
  ADMINISTRADOR: DA_EMPRESA,

  // Balcão: não precisa de permissão para isso.
  FUNCIONARIO: [],
};

export function permissoesDoPerfil(perfil: Perfil): Permissao[] {
  return [...POR_PERFIL[perfil]];
}

export function pode(
  usuario: { perfil: Perfil } | null | undefined,
  permissao: Permissao,
): boolean {
  if (!usuario) return false;
  return POR_PERFIL[usuario.perfil].includes(permissao);
}

/**
 * Perfis que alguém pode atribuir ao cadastrar a equipe.
 *
 * Ninguém promove outra pessoa ao próprio nível ou acima: um administrador que
 * pudesse criar donos daria a si mesmo, pela porta dos fundos, o poder de criar
 * empresas. O dono também não sai daqui — quem entra no time de uma empresa
 * entra como administrador ou funcionário.
 */
export function perfisAtribuiveis(
  ator: { perfil: Perfil } | null | undefined,
): Array<"ADMINISTRADOR" | "FUNCIONARIO"> {
  if (!ator) return [];
  if (ator.perfil === "DONO" || ator.perfil === "ADMINISTRADOR") {
    return ["ADMINISTRADOR", "FUNCIONARIO"];
  }
  return [];
}
