import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { folhaTematica, colors, fontSize, fontWeight, radius, spacing, touchTarget } from "../../theme";

/**
 * O botão.
 *
 * Quatro variantes e nada mais. `primario` é a ação que a tela existe para
 * fazer, e só aparece uma vez por tela; `secundario` é alternativa legítima;
 * `sutil` é ação terciária que não deve competir; `perigo` é o que remove algo.
 *
 * Enquanto `carregando` está ligado o botão fica desabilitado e mostra o
 * indicador no lugar do rótulo. Isso não é enfeite: sem isso, um toque duplo em
 * "Registrar compra" com rede lenta lança dois selos.
 */

export type VarianteBotao = "primario" | "secundario" | "sutil" | "perigo";

interface BotaoProps {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  carregando?: boolean;
  desabilitado?: boolean;
  /** Ícone à esquerda do rótulo, do conjunto Ionicons. */
  icone?: React.ComponentProps<typeof Ionicons>["name"];
  /** Ocupa a largura disponível. Padrão em formulário e folha inferior. */
  largura?: "conteudo" | "cheia";
  compacto?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PALETA: Record<VarianteBotao, { fundo: string; texto: string; borda: string }> = {
  primario: { fundo: colors.primary, texto: colors.primaryForeground, borda: colors.primary },
  secundario: { fundo: colors.surface, texto: colors.heading, borda: colors.border },
  sutil: { fundo: "transparent", texto: colors.secondaryForeground, borda: "transparent" },
  perigo: { fundo: colors.dangerSubtle, texto: colors.danger, borda: colors.dangerSubtle },
};

export function Botao({
  titulo,
  onPress,
  variante = "primario",
  carregando = false,
  desabilitado = false,
  icone,
  largura = "conteudo",
  compacto = false,
  style,
}: BotaoProps) {
  const cor = PALETA[variante];
  const inerte = desabilitado || carregando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inerte}
      accessibilityRole="button"
      accessibilityState={{ disabled: inerte, busy: carregando }}
      accessibilityLabel={titulo}
      style={({ pressed }) => [
        estilos.base,
        compacto && estilos.compacto,
        {
          backgroundColor: cor.fundo,
          borderColor: cor.borda,
          alignSelf: largura === "cheia" ? "stretch" : "flex-start",
        },
        // Sem sombra e sem escala: o retorno de toque é o próprio escurecer, que
        // combina com a estética de papel do resto.
        pressed && !inerte && { opacity: 0.72 },
        inerte && { opacity: 0.45 },
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={cor.texto} />
      ) : (
        <View style={estilos.conteudo}>
          {icone ? <Ionicons name={icone} size={16} color={cor.texto} /> : null}
          <Text
            numberOfLines={1}
            style={{
              color: cor.texto,
              fontSize: compacto ? fontSize.sm : fontSize.md,
              fontWeight: fontWeight.semibold,
            }}
          >
            {titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Botão só de ícone — para a barra de topo e para ações repetidas numa lista.
 *
 * A área de toque é sempre de 44px mesmo quando o ícone é menor: um alvo de 20px
 * num balcão faz errar, e errar aqui significa cancelar a entrega errada.
 */
export function BotaoIcone({
  icone,
  onPress,
  rotulo,
  cor = colors.heading,
  desabilitado = false,
}: {
  icone: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  /** Obrigatório: é o que o leitor de tela anuncia. */
  rotulo: string;
  cor?: string;
  desabilitado?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={8}
      style={({ pressed }) => [
        estilos.botaoIcone,
        pressed && !desabilitado && { opacity: 0.6 },
        desabilitado && { opacity: 0.4 },
      ]}
    >
      <Ionicons name={icone} size={22} color={cor} />
    </Pressable>
  );
}

/*
 * Folha por esquema, e não uma só criada na importação: `StyleSheet.create`
 * congela as cores no instante em que roda, e no topo do módulo isso é uma vez
 * só, com o tema que estava valendo. Ver `folhaTematica`.
 */
const estilos = folhaTematica(() => StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.none,
    alignItems: "center",
    justifyContent: "center",
  },
  compacto: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  conteudo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  botaoIcone: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
}));
