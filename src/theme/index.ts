/**
 * O tema, num lugar só.
 *
 * Os valores vêm de `globals.css` do painel web — os mesmos hexadecimais, para
 * que app e navegador não divirjam com o tempo. Nenhum componente escreve cor
 * literal: quando o produto mudar o verde, muda aqui e propaga.
 *
 * Canto reto em tudo (`radius.none`). Não é gosto: o produto vive num balcão e
 * substitui papel — cartão de carimbo, cupom, comanda. Papel tem canto vivo e
 * borda impressa, não sombra difusa e canto de 16px.
 */

/** Escala da marca, de fundo quase branco a verde de título. */
export const brand = {
  50: "#F0FFF7",
  100: "#7DFABE",
  200: "#6AE899",
  300: "#56FF95",
  400: "#76DB9B",
  500: "#30B27F",
  600: "#25976B",
  700: "#1D7957",
  800: "#175F46",
  900: "#104936",
} as const;

const claras = {
  /* Superfícies ------------------------------------------------------------ */
  background: "#F7FAF9",
  surface: "#FFFFFF",
  /** Fundo de bloco secundário dentro de um cartão. */
  surfaceMuted: "#EEF2F0",

  /* Texto ----------------------------------------------------------------- */
  foreground: "#17211D",
  /** Títulos e itens ativos, em verde escuro. */
  heading: "#104936",
  muted: "#66736D",

  /* Marca ----------------------------------------------------------------- */
  primary: "#30B27F",
  /**
   * O rótulo do botão primário vai em verde escuro, não branco: sobre #30B27F o
   * branco dá 2,7:1 e reprova o AA, enquanto #08291D dá 5,7:1.
   */
  primaryForeground: "#08291D",

  secondary: "#EEF6F2",
  secondaryForeground: "#175F46",

  accent: "#E8F8F0",
  accentForeground: "#104936",

  /* Bordas ---------------------------------------------------------------- */
  border: "#E3ECE7",
  input: "#E3ECE7",
  ring: "#30B27F",

  /* Estados --------------------------------------------------------------- */
  danger: "#DC3545",
  dangerForeground: "#FFFFFF",
  dangerSubtle: "#FDECED",

  warning: "#F59E0B",
  warningForeground: "#4A2C02",
  warningSubtle: "#FEF6E7",

  info: "#2563EB",
  infoForeground: "#FFFFFF",
  infoSubtle: "#EAF0FE",

  success: "#1D7957",
  successForeground: "#FFFFFF",
  successSubtle: "#E8F8F0",
} as const;

/**
 * A paleta escura.
 *
 * <b>Neutros de verdade, sem verde no fundo.</b> Tingir toda superfície com a
 * marca não produz um tema escuro, produz um tema verde-escuro — e nele o
 * próprio verde deixa de se destacar de onde está apoiado: um selo verde sobre
 * um cartão verde não significa mais nada.
 *
 * O verde aparece só onde carrega informação: ação primária, foco, título e os
 * tons de estado. Os mesmos hexadecimais do bloco `.dark` do painel web, para
 * app e navegador não divergirem com o tempo.
 */
/** Todas as chaves da paleta, com valor livre — `as const` na clara torna cada
    valor um tipo literal, e aí nenhuma outra cor caberia na mesma chave. */
export type Paleta = Record<keyof typeof claras, string>;

const escuras: Paleta = {
  background: "#0B0B0C",
  surface: "#141416",
  surfaceMuted: "#1C1C1F",

  foreground: "#F2F2F3",
  heading: "#6FE3AC",
  muted: "#A1A1A6",

  primary: "#56FF95",
  // Sobre o verde claro do escuro, o texto vai em verde bem escuro pelo mesmo
  // motivo do tema claro: branco ali reprova o contraste mínimo.
  primaryForeground: "#082018",

  secondary: "#1C1C1F",
  secondaryForeground: "#E4E4E7",

  accent: "#26262A",
  accentForeground: "#E4E4E7",

  border: "#2A2A2E",
  input: "#2A2A2E",
  ring: "#56FF95",

  danger: "#F4707C",
  dangerForeground: "#2A0508",
  dangerSubtle: "#33161A",

  warning: "#FBBF4A",
  warningForeground: "#2A1A02",
  warningSubtle: "#33260F",

  info: "#7EA8FF",
  infoForeground: "#051333",
  infoSubtle: "#17233F",

  success: "#6AE899",
  successForeground: "#062015",
  successSubtle: "#14301F",
};

export type Esquema = "claro" | "escuro";

let esquemaAtual: Esquema = "claro";
const ouvintes = new Set<() => void>();

/**
 * As cores do esquema em vigor.
 *
 * <b>É um `Proxy`, e não um objeto.</b> O motivo é o tamanho do que já existe:
 * cerca de duzentas leituras de `colors.*` espalhadas por vinte arquivos, mais
 * quarenta e um componentes que leem folhas de estilo criadas no topo do módulo.
 * Trocar a cor por dependência explícita significaria um hook em cada um deles —
 * e bastaria esquecer um para uma tela ficar clara dentro do tema escuro, que é
 * justamente o defeito difícil de achar.
 *
 * Aqui a leitura acontece na hora do acesso, durante a renderização. Trocar o
 * esquema e renderizar de novo a raiz basta para tudo mudar junto.
 */
export const colors: Paleta = new Proxy({} as Paleta, {
  get: (_, chave) => (esquemaAtual === "escuro" ? escuras : claras)[chave as keyof Paleta],
  // `Object.keys(colors)` e espalhamento continuam funcionando.
  ownKeys: () => Reflect.ownKeys(claras),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/** Avisa quem depende do esquema. Sem efeito se o esquema não mudou. */
export function definirEsquema(esquema: Esquema): void {
  if (esquema === esquemaAtual) return;
  esquemaAtual = esquema;
  ouvintes.forEach((avisar) => avisar());
}

export function esquemaEmVigor(): Esquema {
  return esquemaAtual;
}

/**
 * Uma folha de estilo por esquema, criada uma vez cada.
 *
 * `StyleSheet.create` congela as cores no instante em que roda — no topo do
 * módulo, portanto uma vez só, com o tema que estava valendo. Aqui a folha é
 * criada sob demanda para cada esquema e guardada; o `Proxy` devolve a do
 * esquema em vigor no momento do acesso.
 *
 * Use exatamente como se usava a folha estática:
 * `const estilos = folhaTematica(() => StyleSheet.create({ ... }))`.
 */
export function folhaTematica<T extends object>(criar: () => T): T {
  const cache = {} as Record<Esquema, T | undefined>;

  const folha = (): T => {
    const anterior = esquemaAtual;
    const pronta = cache[anterior];
    if (pronta) return pronta;

    const nova = criar();
    cache[anterior] = nova;
    return nova;
  };

  return new Proxy({} as T, {
    get: (_, chave) => folha()[chave as keyof T],
    ownKeys: () => Reflect.ownKeys(folha()),
    getOwnPropertyDescriptor: (_, chave) =>
      Reflect.getOwnPropertyDescriptor(folha(), chave),
  });
}

/** Para a raiz redesenhar quando o esquema muda. */
export function ouvirEsquema(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  return () => ouvintes.delete(aoMudar);
}

/** Passo de 4px. Só estes valores aparecem em margem e padding. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

/** Canto reto em tudo; `pill` só para o indicador circular de selo. */
export const radius = {
  none: 0,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/** Espessura de borda. 1px em quase tudo; 2px marca seleção e foco. */
export const borderWidth = {
  hairline: 1,
  thick: 2,
} as const;

/** Altura mínima de alvo de toque — balcão, dedo, pressa. */
export const touchTarget = 44;

export const theme = {
  brand,
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  borderWidth,
  touchTarget,
} as const;

export type Theme = typeof theme;

/* -------------------------------------------------------------------------- */
/* Tons por situação                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Os quatro tons que um selo de situação pode ter.
 *
 * Cada tom é um par fundo/texto já conferido para contraste, de modo que
 * nenhuma tela precise escolher os dois lados e errar um.
 */
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

type ParDeTom = { background: string; foreground: string; border: string };

/**
 * Também lido no acesso, e não montado na importação: um objeto literal aqui
 * congelaria os seis pares com as cores do tema que estava valendo quando o
 * módulo carregou, e os selos ficariam claros dentro do tema escuro.
 */
export const toneColors: Record<Tone, ParDeTom> = new Proxy({} as Record<Tone, ParDeTom>, {
  get: (_, tom) => {
    const pares: Record<Tone, ParDeTom> = {
      neutral: { background: colors.surfaceMuted, foreground: colors.muted, border: colors.border },
      success: { background: colors.successSubtle, foreground: colors.success, border: colors.successSubtle },
      warning: { background: colors.warningSubtle, foreground: colors.warningForeground, border: colors.warningSubtle },
      danger: { background: colors.dangerSubtle, foreground: colors.danger, border: colors.dangerSubtle },
      info: { background: colors.infoSubtle, foreground: colors.info, border: colors.infoSubtle },
      brand: { background: colors.accent, foreground: colors.accentForeground, border: colors.accent },
    };
    return pares[tom as Tone];
  },
});
