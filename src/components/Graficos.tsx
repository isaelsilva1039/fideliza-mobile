import { View } from "react-native";

import { colors, folhaTematica, fontSize, radius, spacing } from "../theme";
import { Apoio, Texto } from "./ui/base";
import { StyleSheet } from "react-native";

/**
 * As duas formas de gráfico do app.
 *
 * Retângulos com `View`, e não SVG. As barras são exatamente isto — retângulos
 * proporcionais —, e o flexbox já dá a proporção sem medir nada: `flex: 1` por
 * coluna e altura em porcentagem do maior valor. SVG só seria necessário para
 * linha ou curva, que não existem aqui, e exigiria medir a largura do
 * contêiner antes de desenhar.
 *
 * Duas decisões valem para as duas formas:
 *
 * 1. **Uma cor por gráfico.** Colorir cada barra de um tom diferente gastaria o
 *    canal de identidade repetindo o que o comprimento da barra já diz. Quando
 *    uma barra é o assunto (a hora de pico, o cartão a um selo do fim), ela
 *    recebe a cor e as outras ficam em cinza — ênfase é mais legível.
 *
 * 2. **O valor não fica preso em toque nenhum.** No celular não há tooltip: o
 *    número vai ao lado da barra onde cabe, e onde são trinta barras o gráfico
 *    mostra a forma e os números moram na lista abaixo dele.
 */

/* -------------------------------------------------------------------------- */

/**
 * Colunas verticais.
 *
 * @param destaque índice da coluna que é o assunto; as outras vão para o cinza
 * @param rotulos rótulo sob cada coluna. Ligue só quando forem poucas
 */
export function Colunas({
  dados,
  destaque,
  rotulos = true,
  altura = 132,
}: {
  dados: Array<{ rotulo: string; valor: number }>;
  destaque?: number;
  rotulos?: boolean;
  altura?: number;
}) {
  const maior = Math.max(...dados.map((item) => item.valor), 1);

  return (
    <View>
      <View style={[estilos.colunas, { height: altura }]}>
        {dados.map((item, indice) => (
          <View key={`${item.rotulo}-${indice}`} style={estilos.colunaSlot}>
            <View
              style={[
                estilos.coluna,
                {
                  /*
                   * Um fio de altura mesmo no zero: a coluna sumida faria o dia
                   * sem venda parecer um buraco no eixo, e o dia sem venda é
                   * justamente o que se quer enxergar.
                   */
                  height: Math.max(2, Math.round((item.valor / maior) * (altura - 4))),
                  backgroundColor:
                    destaque === undefined || destaque === indice
                      ? colors.chart1
                      : colors.chartMuted,
                },
              ]}
            />
          </View>
        ))}
      </View>

      {rotulos ? (
        <View style={estilos.colunasRotulos}>
          {dados.map((item, indice) => (
            <View key={`${item.rotulo}-${indice}`} style={estilos.colunaSlot}>
              <Apoio style={estilos.rotuloDeColuna} numberOfLines={1}>
                {item.rotulo}
              </Apoio>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Barras horizontais, com o rótulo em cima e o valor na ponta.
 *
 * Horizontal porque os rótulos são nomes de pessoa, de campanha e faixas como
 * "mais de 90 dias": na vertical eles seriam truncados ou girados, e girado
 * ninguém lê — ainda mais em tela de celular.
 */
export function Barras({
  dados,
  formatarValor = (valor) => String(valor),
}: {
  dados: Array<{ rotulo: string; valor: number; apoio?: string }>;
  formatarValor?: (valor: number) => string;
}) {
  const maior = Math.max(...dados.map((item) => item.valor), 1);

  return (
    <View style={{ gap: spacing.sm }}>
      {dados.map((item, indice) => (
        <View key={`${item.rotulo}-${indice}`} style={{ gap: 4 }}>
          <View style={estilos.linhaDeRotulo}>
            <Texto style={estilos.rotuloDeBarra} numberOfLines={1}>
              {item.rotulo}
            </Texto>
            <Texto style={estilos.valorDeBarra}>{formatarValor(item.valor)}</Texto>
          </View>

          <View style={estilos.trilho}>
            <View
              style={[
                estilos.barra,
                { width: `${Math.max(2, Math.round((item.valor / maior) * 100))}%` },
              ]}
            />
          </View>

          {item.apoio ? <Apoio>{item.apoio}</Apoio> : null}
        </View>
      ))}
    </View>
  );
}

const estilos = folhaTematica(() =>
  StyleSheet.create({
    colunas: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
    },
    colunaSlot: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    coluna: {
      width: "100%",
      maxWidth: 24,
      borderTopLeftRadius: radius.none,
      borderTopRightRadius: radius.none,
    },
    colunasRotulos: {
      flexDirection: "row",
      gap: 2,
      marginTop: spacing.xs,
    },
    rotuloDeColuna: {
      fontSize: fontSize.xs,
      textAlign: "center",
    },
    linhaDeRotulo: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    rotuloDeBarra: {
      flex: 1,
      fontSize: fontSize.sm,
    },
    valorDeBarra: {
      fontSize: fontSize.sm,
      fontVariant: ["tabular-nums"],
      color: colors.heading,
    },
    /* O trilho é o fundo da grade: dá a escala sem precisar de eixo. */
    trilho: {
      height: 10,
      backgroundColor: colors.chartGrid,
      overflow: "hidden",
    },
    barra: {
      height: "100%",
      backgroundColor: colors.chart1,
    },
  }),
);
