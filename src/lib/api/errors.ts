/**
 * O erro que as telas tratam.
 *
 * A API responde em português (`codigo`, `mensagem`, `errosPorCampo`) e essa
 * mensagem já está escrita para quem está no balcão — então ela sobe intacta
 * até a tela. O que esta classe acrescenta é o resto: status HTTP para decidir
 * se cabe reautenticar, e os erros por campo para marcar o formulário.
 */
export class ApiError extends Error {
  constructor(
    readonly codigo: string,
    message: string,
    readonly status: number,
    readonly errosPorCampo?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * A requisição não chegou ao servidor.
   *
   * No celular isso é o caso comum, não a exceção: o balcão tem wifi ruim e o
   * aparelho troca de rede no meio do expediente. A mensagem diz o que fazer.
   */
  static rede(url: string): ApiError {
    return new ApiError(
      "REDE",
      `Não foi possível alcançar o servidor em ${url}. Confira a conexão e tente de novo.`,
      0,
    );
  }

  static naoAutorizado(): ApiError {
    return new ApiError("NAO_AUTORIZADO", "Sua sessão expirou. Entre novamente.", 401);
  }

  static semPermissao(): ApiError {
    return new ApiError("SEM_PERMISSAO", "Você não tem permissão para isso.", 403);
  }

  static naoEncontrado(): ApiError {
    return new ApiError("NAO_ENCONTRADO", "Não encontramos o que você procura.", 404);
  }

  static conflito(): ApiError {
    return new ApiError("CONFLITO", "Conflito ao salvar. Recarregue e tente novamente.", 409);
  }

  static servidor(): ApiError {
    return new ApiError("SERVIDOR", "Erro inesperado. Tente novamente.", 500);
  }

  /** `true` quando reentrar resolve — a tela pode mandar o usuário ao login. */
  get exigeLogin(): boolean {
    return this.status === 401;
  }
}

/**
 * A frase que vai para a tela.
 *
 * Todo caminho de erro passa por aqui, inclusive o que não é `ApiError` (um
 * `TypeError` de programação, por exemplo). O pior resultado possível é o botão
 * parar de girar e nada aparecer, então esta função nunca devolve vazio.
 */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.message;
  if (erro instanceof Error && erro.message) return erro.message;
  return "Erro inesperado. Tente novamente.";
}

/** Erros por campo, quando a API os enviou. Serve para marcar o formulário. */
export function errosPorCampo(erro: unknown): Record<string, string> {
  return erro instanceof ApiError ? (erro.errosPorCampo ?? {}) : {};
}
