import { Ionicons } from "@expo/vector-icons";
import { Children, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { colors, fontSize, fontWeight, radius, spacing, toneColors, type Tone } from "../../theme";
import { iniciais as calcularIniciais } from "../../lib/format";

/**
 * As primitivas visuais.
 *
 * Nenhuma cor literal aparece aqui — tudo sai de `theme`. Canto reto em tudo,
 * como no painel web: o produto substitui papel de balcão, e papel tem canto
 * vivo e borda impressa, não sombra difusa.
 */

/* -------------------------------------------------------------------------- */
/* Tipografia                                                                 */
/* -------------------------------------------------------------------------- */

interface TextoProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Título de tela ou de seção, em verde escuro. */
export function Titulo({ children, nivel = 1, style, numberOfLines }: TextoProps & { nivel?: 1 | 2 | 3 }) {
  const porNivel = {
    1: { fontSize: fontSize["2xl"], fontWeight: fontWeight.bold },
    2: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
    3: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  }[nivel];

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: colors.heading, ...porNivel } as TextStyle, style]}
    >
      {children}
    </Text>
  );
}

export function Texto({ children, style, numberOfLines }: TextoProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: colors.foreground, fontSize: fontSize.md }, style]}
    >
      {children}
    </Text>
  );
}

/** Texto de apoio: legenda, unidade, "há 3 dias". */
export function Apoio({ children, style, numberOfLines }: TextoProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: colors.muted, fontSize: fontSize.sm }, style]}
    >
      {children}
    </Text>
  );
}

/** Rótulo de campo e cabeçalho de seção — maiúsculas, espaçado. */
export function Rotulo({ children, style }: TextoProps) {
  return (
    <Text
      style={[
        {
          color: colors.muted,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        } as TextStyle,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Número grande de indicador. Tabular para os dígitos não dançarem ao atualizar. */
export function Numero({ children, style }: TextoProps) {
  return (
    <Text
      style={[
        {
          color: colors.heading,
          fontSize: fontSize["2xl"],
          fontWeight: fontWeight.bold,
          fontVariant: ["tabular-nums"],
        } as TextStyle,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* -------------------------------------------------------------------------- */
/* Superfícies                                                                */
/* -------------------------------------------------------------------------- */

export function Cartao({
  children,
  style,
  destaque = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Borda verde: usado para o que exige ação (sorteio pronto, entrega pendente). */
  destaque?: boolean;
}) {
  return (
    <View
      style={[
        estilos.cartao,
        destaque && { borderColor: colors.primary, borderLeftWidth: 3 },
        style,
      ]}
    >
      {textoSeguro(children)}
    </View>
  );
}

export function Divisor({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.divisor, style]} />;
}

/** Bloco com rótulo acima — a unidade de leitura de toda tela de detalhe. */
export function Secao({
  titulo,
  acao,
  children,
  style,
}: {
  titulo: string;
  /** Botão à direita do título (ex. "Ver todos"). */
  acao?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      <View style={estilos.cabecalhoSecao}>
        <Rotulo>{titulo}</Rotulo>
        {acao}
      </View>
      {textoSeguro(children)}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Selo de situação                                                           */
/* -------------------------------------------------------------------------- */

export function Selo({ children, tom = "neutral" }: { children: ReactNode; tom?: Tone }) {
  const cor = toneColors[tom];

  return (
    <View style={[estilos.selo, { backgroundColor: cor.background, borderColor: cor.border }]}>
      <Text style={{ color: cor.foreground, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
        {children}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({ nome, tamanho = 36 }: { nome: string; tamanho?: number }) {
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.accentForeground,
          fontSize: tamanho * 0.36,
          fontWeight: fontWeight.semibold,
        }}
      >
        {calcularIniciais(nome)}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Linha rótulo/valor                                                         */
/* -------------------------------------------------------------------------- */

/** Uma linha de ficha: rótulo à esquerda, valor à direita. */
export function Linha({
  rotulo,
  children,
  style,
}: {
  rotulo: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[estilos.linha, style]}>
      <Apoio style={{ flexShrink: 0 }}>{rotulo}</Apoio>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        {textoSeguro(children, { textAlign: "right" })}
      </View>
    </View>
  );
}

function textoSeguro(children: ReactNode, style?: StyleProp<TextStyle>) {
  return Children.toArray(children).map((child, indice) =>
    typeof child === "string" || typeof child === "number" ? (
      <Texto key={`texto-${indice}`} style={style}>
        {child}
      </Texto>
    ) : (
      child
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Progresso de selos                                                         */
/* -------------------------------------------------------------------------- */

/**
 * O cartão de selos, desenhado como o de papel: um ponto por selo.
 *
 * Acima de 14 selos a fileira de pontos deixa de ser legível num celular e vira
 * barra — mas o número continua visível, porque é ele que o cliente confere.
 */
export function Selos({
  atuais,
  necessarios,
}: {
  atuais: number;
  necessarios: number;
}) {
  const completo = necessarios > 0 && atuais >= necessarios;
  const fracao = necessarios > 0 ? Math.min(1, atuais / necessarios) : 0;

  if (necessarios > 14) {
    return (
      <View style={{ gap: spacing.xs }}>
        <View style={estilos.barraFundo}>
          <View
            style={[
              estilos.barraPreenchida,
              { width: `${fracao * 100}%`, backgroundColor: completo ? colors.success : colors.primary },
            ]}
          />
        </View>
        <Apoio>
          {atuais} de {necessarios} selos
        </Apoio>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={estilos.fileiraDeSelos}>
        {Array.from({ length: necessarios }, (_, indice) => {
          const marcado = indice < atuais;
          return (
            <View
              key={indice}
              style={[
                estilos.ponto,
                marcado
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {marcado ? (
                <Ionicons name="checkmark" size={11} color={colors.primaryForeground} />
              ) : null}
            </View>
          );
        })}
      </View>
      <Apoio>
        {atuais} de {necessarios} selos
      </Apoio>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Ícone com significado                                                      */
/* -------------------------------------------------------------------------- */

export function Icone({
  nome,
  tamanho = 18,
  cor = colors.muted,
}: {
  nome: React.ComponentProps<typeof Ionicons>["name"];
  tamanho?: number;
  cor?: string;
}) {
  return <Ionicons name={nome} size={tamanho} color={cor} />;
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.none,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  divisor: {
    height: 1,
    backgroundColor: colors.border,
  },
  cabecalhoSecao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selo: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: radius.none,
  },
  linha: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  fileiraDeSelos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  ponto: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  barraFundo: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  barraPreenchida: {
    height: "100%",
  },
});
