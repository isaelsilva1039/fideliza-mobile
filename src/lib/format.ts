/**
 * Formatação para leitura humana.
 *
 * Tudo aqui é escrito à mão em vez de delegar ao `Intl`. O Hermes embute um
 * `Intl` parcial cuja cobertura muda entre Android e iOS e entre versões do
 * engine — e uma tela de balcão que mostra "R$ 32.22" num aparelho e
 * "R$ 32,22" no outro perde a confiança de quem confere o caixa. Estas funções
 * dão o mesmo resultado em todo lugar.
 */

/* -------------------------------------------------------------------------- */
/* Dinheiro                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Centavos para `"R$ 32,22"`.
 *
 * Todo valor monetário da API é `long` em centavos: R$ 178.640,00 chega como
 * `17864000`. Dividir por 100 e formatar em ponto flutuante acumularia erro, e
 * aqui se soma muito — então a conversão é feita sobre a representação decimal.
 */
export function moeda(centavos: number): string {
  const negativo = centavos < 0;
  const absoluto = Math.abs(Math.round(centavos));

  const reais = Math.floor(absoluto / 100);
  const resto = absoluto % 100;

  const inteiro = agruparMilhar(String(reais));
  const decimal = String(resto).padStart(2, "0");

  return `${negativo ? "-" : ""}R$ ${inteiro},${decimal}`;
}

/** Centavos para `"32,22"` — sem o símbolo, para dentro de campo de entrada. */
export function moedaSemSimbolo(centavos: number): string {
  return moeda(centavos).replace("R$ ", "");
}

/** `"1234567"` para `"1.234.567"`. */
function agruparMilhar(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * O que o usuário digitou, em centavos.
 *
 * Aceita as duas formas que aparecem num balcão — `"32,22"` e `"32.22"` — e
 * também o valor já digitado como inteiro de centavos pelo teclado numérico.
 * Devolve `null` quando não dá para ler um número, para o formulário poder
 * recusar em vez de enviar zero silenciosamente.
 */
export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.trim().replace(/[R$\s]/g, "");
  if (!limpo) return null;

  // Separador decimal é o último `,` ou `.` quando sobram exatamente 1 ou 2
  // casas depois dele; o resto é agrupamento de milhar e sai fora.
  const match = limpo.match(/^(-?[\d.,]*?)([.,](\d{1,2}))?$/);
  if (!match) return null;

  const inteiro = (match[1] ?? "").replace(/[.,]/g, "");
  const decimal = (match[3] ?? "").padEnd(2, "0");

  if (!inteiro && !match[3]) return null;

  const centavos = Number(`${inteiro || "0"}${decimal}`);
  return Number.isFinite(centavos) ? centavos : null;
}

/* -------------------------------------------------------------------------- */
/* Documento e telefone                                                       */
/* -------------------------------------------------------------------------- */

/** CPF `"12345678901"` para `"123.456.789-01"`; CNPJ para `"12.345.678/0001-99"`. */
export function documento(valor: string): string {
  const digitos = valor.replace(/\D/g, "");

  if (digitos.length === 11) {
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  if (digitos.length === 14) {
    return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  // Já vem mascarado da listagem (`***.456.789-**`) ou é parcial: devolve como está.
  return valor;
}

/** `"98991234567"` para `"(98) 99123-4567"`. */
export function telefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "");

  if (digitos.length === 11) {
    return digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (digitos.length === 10) {
    return digitos.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }

  return valor;
}

/* -------------------------------------------------------------------------- */
/* Data e hora                                                                */
/* -------------------------------------------------------------------------- */

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * A API manda `OffsetDateTime` ISO (`2026-08-04T18:51:51.410778Z`). O `Date` do
 * Hermes lê isso, mas devolver `Invalid Date` numa tela é pior que devolver
 * vazio, então o `null` é explícito.
 */
function paraData(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** `"04 ago 2026"`. */
export function data(iso: string | undefined | null): string {
  const d = paraData(iso);
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** `"04 ago 2026, 18:51"`. */
export function dataHora(iso: string | undefined | null): string {
  const d = paraData(iso);
  if (!d) return "—";
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${data(iso)}, ${hora}`;
}

/** `"04/08"` — para eixo de gráfico e lista densa. */
export function diaMes(iso: string | undefined | null): string {
  const d = paraData(iso);
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Tempo decorrido em linguagem de balcão: "hoje", "ontem", "há 3 dias".
 *
 * Passa a data absoluta depois de duas semanas, quando "há 23 dias" já não
 * ajuda a decidir nada e a data exata ajuda.
 */
export function desde(iso: string | undefined | null): string {
  const d = paraData(iso);
  if (!d) return "—";

  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);

  if (dias < 0) return data(iso);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias <= 14) return `há ${dias} dias`;
  return data(iso);
}

/** Data para o formato que a API aceita em `iniciaEm`/`terminaEm`. */
export function paraIso(d: Date): string {
  return d.toISOString();
}

/* -------------------------------------------------------------------------- */
/* Texto                                                                      */
/* -------------------------------------------------------------------------- */

/** `plural(1, "selo", "selos")` para `"1 selo"`. */
export function plural(quantidade: number, singular: string, plural_: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural_}`;
}

/** Primeiro nome, com inicial maiúscula — a API devolve como foi cadastrado. */
export function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return primeiro ? primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase() : "";
}

/** Iniciais para o avatar: "Isael Duarte" para "ID". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Percentual inteiro, com sinal — para a variação dos indicadores. */
export function variacao(fracao: number | null | undefined): string | null {
  if (fracao === null || fracao === undefined) return null;
  const pontos = Math.round(fracao * 100);
  return `${pontos > 0 ? "+" : ""}${pontos}%`;
}
