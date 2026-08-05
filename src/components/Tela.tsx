import type { ReactNode } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, spacing } from "../theme";
import { Titulo } from "./ui/base";
import { BotaoIcone } from "./ui/Botao";

/**
 * O esqueleto de toda tela.
 *
 * Resolve num lugar o que senão apareceria repetido em quinze: recuo da barra de
 * status, cabeçalho com voltar, rolagem e "arraste para atualizar".
 *
 * O recuo do topo é calculado à mão porque não há `safe-area-context` aqui — e
 * não há porque ele é um módulo nativo, e o app precisa rodar no Expo Go da loja.
 * No iOS o `SafeAreaView` da casca já resolveu; no Android sobra a barra de
 * status, cuja altura o próprio `StatusBar` informa.
 */

const RECUO_STATUS = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

interface TelaProps {
  titulo: string;
  /** Linha de apoio abaixo do título — costuma dizer o total ou o período. */
  subtitulo?: string;
  /** Mostra a seta de voltar e chama isto ao tocar. */
  aoVoltar?: () => void;
  /** Ações no canto direito do cabeçalho. */
  acoes?: ReactNode;
  children: ReactNode;
  /** Barra fixa no pé, fora da rolagem — para a ação principal da tela. */
  rodape?: ReactNode;
  /** Liga "arraste para atualizar". */
  aoAtualizar?: () => void;
  atualizando?: boolean;
  /**
   * Desliga a rolagem — para telas que já rolam por conta (`FlatList`) e
   * aninhariam duas rolagens verticais, que no Android trava a de dentro.
   */
  semRolagem?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Tela({
  titulo,
  subtitulo,
  aoVoltar,
  acoes,
  children,
  rodape,
  aoAtualizar,
  atualizando = false,
  semRolagem = false,
  contentStyle,
}: TelaProps) {
  const cabecalho = (
    <View style={estilos.cabecalho}>
      {aoVoltar ? (
        <BotaoIcone icone="arrow-back" rotulo="Voltar" onPress={aoVoltar} />
      ) : null}

      <View style={[estilos.tituloArea, !aoVoltar && { paddingLeft: spacing.lg }]}>
        <Titulo nivel={aoVoltar ? 2 : 1} numberOfLines={1}>
          {titulo}
        </Titulo>
        {subtitulo ? (
          <Titulo nivel={3} style={estilos.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Titulo>
        ) : null}
      </View>

      {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
    </View>
  );

  return (
    <View style={estilos.raiz}>
      <View style={{ height: RECUO_STATUS, backgroundColor: colors.surface }} />
      {cabecalho}

      {semRolagem ? (
        <View style={[estilos.corpo, contentStyle]}>{children}</View>
      ) : (
        <ScrollView
          contentContainerStyle={[estilos.corpoRolavel, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            aoAtualizar ? (
              <RefreshControl
                refreshing={atualizando}
                onRefresh={aoAtualizar}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      )}

      {rodape ? <View style={estilos.rodape}>{rodape}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingRight: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tituloArea: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  subtitulo: {
    color: colors.muted,
    fontWeight: "400",
  },
  acoes: {
    flexDirection: "row",
    alignItems: "center",
  },
  corpo: {
    flex: 1,
  },
  corpoRolavel: {
    padding: spacing.lg,
    gap: spacing.lg,
    // Espaço para o último item não ficar sob os avisos que sobem no rodapé.
    paddingBottom: spacing["3xl"],
  },
  rodape: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
