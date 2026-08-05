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

export const colors = {
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

export const toneColors: Record<Tone, { background: string; foreground: string; border: string }> = {
  neutral: { background: colors.surfaceMuted, foreground: colors.muted, border: colors.border },
  success: { background: colors.successSubtle, foreground: colors.success, border: colors.successSubtle },
  warning: { background: colors.warningSubtle, foreground: colors.warningForeground, border: colors.warningSubtle },
  danger: { background: colors.dangerSubtle, foreground: colors.danger, border: colors.dangerSubtle },
  info: { background: colors.infoSubtle, foreground: colors.info, border: colors.infoSubtle },
  brand: { background: colors.accent, foreground: colors.accentForeground, border: colors.accent },
};
