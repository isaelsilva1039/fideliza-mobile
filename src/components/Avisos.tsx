import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, spacing } from "../theme";
import { useAvisos, type TipoDeAviso } from "../stores/avisos";

/**
 * Os avisos na tela.
 *
 * Entram por cima de tudo, no rodapé — e não no topo, onde a barra de status e o
 * cabeçalho já competem por atenção. Tocar descarta antes do tempo.
 *
 * `pointerEvents: box-none` no contêiner é o que impede a faixa invisível de
 * engolir toques destinados à tela por baixo.
 */

const PALETA: Record<TipoDeAviso, { fundo: string; texto: string; icone: React.ComponentProps<typeof Ionicons>["name"] }> = {
  sucesso: { fundo: colors.success, texto: colors.successForeground, icone: "checkmark-circle" },
  erro: { fundo: colors.danger, texto: colors.dangerForeground, icone: "alert-circle" },
  informacao: { fundo: colors.heading, texto: "#FFFFFF", icone: "information-circle" },
};

export function Avisos() {
  const fila = useAvisos((estado) => estado.fila);
  const descartar = useAvisos((estado) => estado.descartar);

  if (fila.length === 0) return null;

  return (
    <View style={estilos.container} pointerEvents="box-none">
      {fila.map((aviso) => {
        const paleta = PALETA[aviso.tipo];
        return (
          <Pressable
            key={aviso.id}
            onPress={() => descartar(aviso.id)}
            accessibilityRole="alert"
            accessibilityLabel={aviso.texto}
            style={[estilos.aviso, { backgroundColor: paleta.fundo }]}
          >
            <Ionicons name={paleta.icone} size={18} color={paleta.texto} />
            <Text style={[estilos.texto, { color: paleta.texto }]}>{aviso.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  texto: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
