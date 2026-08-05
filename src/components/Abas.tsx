import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { pode } from "../constants/permissoes";
import { MENU, type ItemDeMenu } from "../navigation/rotas";
import type { Usuario } from "../services/contrato";
import { colors, fontSize, fontWeight, spacing, touchTarget } from "../theme";
import { useNavegacao } from "../stores/navegacao";

/**
 * A barra de abas.
 *
 * Só aparecem os itens que o perfil alcança, com a mesma tabela do painel web —
 * o funcionário vê quatro abas, o administrador seis, o dono sete. Esconder o que
 * não se pode usar é o que mantém o menu de quem só atende o balcão curto.
 *
 * Acima de cinco itens a barra rola na horizontal em vez de comprimir os
 * rótulos até ilegíveis: um item de 40px de largura com texto cortado é pior que
 * um item fora de vista que se alcança arrastando.
 */
export function Abas({ usuario }: { usuario: Usuario }) {
  const aba = useNavegacao((estado) => estado.aba);
  const irPara = useNavegacao((estado) => estado.irPara);

  const itens = useMemo(
    () => MENU.filter((item) => !item.permissao || pode(usuario, item.permissao)),
    [usuario],
  );

  const rolar = itens.length > 5;

  const conteudo = itens.map((item) => (
    <ItemDeAba
      key={item.rota}
      item={item}
      ativo={item.rota === aba}
      largura={rolar ? 84 : undefined}
      onPress={() => irPara(item.rota)}
    />
  ));

  return (
    <View style={estilos.barra}>
      {rolar ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.conteudoRolavel}
        >
          {conteudo}
        </ScrollView>
      ) : (
        <View style={estilos.conteudoFixo}>{conteudo}</View>
      )}
    </View>
  );
}

function ItemDeAba({
  item,
  ativo,
  largura,
  onPress,
}: {
  item: ItemDeMenu;
  ativo: boolean;
  largura?: number;
  onPress: () => void;
}) {
  const cor = ativo ? colors.heading : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={item.titulo}
      accessibilityHint={item.dica}
      style={({ pressed }) => [
        estilos.item,
        largura ? { width: largura } : { flex: 1 },
        pressed && { opacity: 0.6 },
      ]}
    >
      {/* A marca do item ativo é a barra verde no topo, e não só a cor do
          ícone: cor sozinha não distingue para quem não separa verde de cinza. */}
      <View style={[estilos.marca, ativo && { backgroundColor: colors.primary }]} />
      <Ionicons
        name={
          (ativo
            ? item.icone.replace("-outline", "")
            : item.icone) as React.ComponentProps<typeof Ionicons>["name"]
        }
        size={22}
        color={cor}
      />
      <Text
        numberOfLines={1}
        style={{
          color: cor,
          fontSize: fontSize.xs,
          fontWeight: ativo ? fontWeight.semibold : fontWeight.regular,
        }}
      >
        {item.titulo}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  barra: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  conteudoFixo: {
    flexDirection: "row",
  },
  conteudoRolavel: {
    flexDirection: "row",
  },
  item: {
    minHeight: touchTarget + 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingBottom: spacing.xs,
  },
  marca: {
    height: 2,
    alignSelf: "stretch",
    marginBottom: spacing.xs,
    backgroundColor: "transparent",
  },
});
