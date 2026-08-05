import { StyleSheet, View } from "react-native";

import type { Pagina } from "../../services/contrato";
import { spacing } from "../../theme";
import { Apoio } from "./base";
import { BotaoIcone } from "./Botao";

/**
 * A paginação.
 *
 * O backend numera as páginas a partir de 1, e este componente também — traduzir
 * para 0 em algum ponto intermediário é como se erra a última página.
 *
 * Some quando há uma página só: dois botões inertes e "1 de 1" não informam nada
 * que a própria lista não diga.
 */
export function Paginacao({
  pagina,
  onChange,
}: {
  pagina: Pick<Pagina<unknown>, "page" | "totalPages" | "totalElements">;
  onChange: (pagina: number) => void;
}) {
  if (pagina.totalPages <= 1) return null;

  const primeira = pagina.page <= 1;
  const ultima = pagina.page >= pagina.totalPages;

  return (
    <View style={estilos.barra}>
      <BotaoIcone
        icone="chevron-back"
        rotulo="Página anterior"
        onPress={() => onChange(pagina.page - 1)}
        desabilitado={primeira}
      />
      <View style={{ alignItems: "center" }}>
        <Apoio>
          Página {pagina.page} de {pagina.totalPages}
        </Apoio>
        <Apoio>{pagina.totalElements} no total</Apoio>
      </View>
      <BotaoIcone
        icone="chevron-forward"
        rotulo="Próxima página"
        onPress={() => onChange(pagina.page + 1)}
        desabilitado={ultima}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
});
