import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { colors, spacing } from "../../theme";
import { Titulo } from "./base";
import { BotaoIcone } from "./Botao";

/**
 * A folha que sobe de baixo — onde todo formulário curto acontece.
 *
 * É `Modal` do React Native, não uma biblioteca de folha: o `Modal` já resolve o
 * que importa (voltar no Android fecha, o conteúdo fica acima de tudo) sem
 * módulo nativo novo.
 *
 * O `KeyboardAvoidingView` não é opcional. Sem ele, o teclado cobre o botão de
 * salvar em qualquer formulário de mais de dois campos, e o usuário conclui que o
 * app travou.
 */
export function Folha({
  visivel,
  titulo,
  aoFechar,
  children,
  rodape,
  grande = false,
}: {
  visivel: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  /** Fica fixo no pé, fora da área que rola — é onde vão os botões. */
  rodape?: ReactNode;
  grande?: boolean;
}) {
  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      // No Android é o que faz o botão físico de voltar fechar a folha em vez de
      // sair da tela por baixo dela.
      onRequestClose={aoFechar}
      statusBarTranslucent
    >
      <View style={estilos.fundo}>
        {/* Tocar fora fecha. A área é irmã do painel, não mãe, para o toque
            dentro do formulário não borbulhar até aqui. */}
        <Pressable style={estilos.areaDeFora} onPress={aoFechar} accessibilityLabel="Fechar" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={estilos.ancora}
        >
          <View style={[estilos.painel, grande && estilos.painelGrande]}>
            <View style={estilos.cabecalho}>
              <Titulo nivel={2} style={{ flex: 1 }} numberOfLines={1}>
                {titulo}
              </Titulo>
              <BotaoIcone icone="close" rotulo="Fechar" onPress={aoFechar} />
            </View>

            <ScrollView
              contentContainerStyle={estilos.corpo}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {rodape ? <View style={estilos.rodape}>{rodape}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Confirmação de ação destrutiva.
 *
 * Não usa `Alert.alert` porque o diálogo nativo não aceita o tema — e porque a
 * ação destrutiva precisa dizer o que exatamente será perdido, com mais de uma
 * linha, o que o `Alert` do Android trunca.
 */
export function Confirmacao({
  visivel,
  titulo,
  children,
  aoFechar,
  rodape,
}: {
  visivel: boolean;
  titulo: string;
  children: ReactNode;
  aoFechar: () => void;
  rodape: ReactNode;
}) {
  return (
    <Modal visible={visivel} animationType="fade" transparent onRequestClose={aoFechar} statusBarTranslucent>
      <View style={estilos.fundoCentrado}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar" />
        <View style={estilos.dialogo}>
          <Titulo nivel={2}>{titulo}</Titulo>
          <View style={{ gap: spacing.sm }}>{children}</View>
          <View style={estilos.rodapeDialogo}>{rodape}</View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(16, 73, 54, 0.45)",
    justifyContent: "flex-end",
  },
  areaDeFora: {
    ...StyleSheet.absoluteFillObject,
  },
  ancora: {
    justifyContent: "flex-end",
  },
  painel: {
    backgroundColor: colors.background,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    maxHeight: "88%",
  },
  painelGrande: {
    maxHeight: "95%",
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  corpo: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  rodape: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  fundoCentrado: {
    flex: 1,
    backgroundColor: "rgba(16, 73, 54, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogo: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rodapeDialogo: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
