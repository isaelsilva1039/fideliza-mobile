import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Botao,
  BotaoIcone,
  Cartao,
  Conteudo,
  Divisor,
  Icone,
  Linha,
  Numero,
  Rotulo,
  Secao,
  Selo,
  Selos,
  Seletor,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { useInicio } from "../hooks/use-queries";
import { desde, diaMes, moeda, plural, telefone, variacao } from "../lib/format";
import { ROTULO_SITUACAO_CAMPANHA, type PontoDoDia, type ResumoInicio } from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useEmpresas, useSession } from "../stores/session";
import { borderWidth, colors, fontSize, spacing } from "../theme";

/**
 * O início.
 *
 * A ordem das seções é a ordem das perguntas de quem abre o app de manhã: como
 * foi o movimento, o que exige uma ação minha agora, e só depois o resumo do que
 * está no ar. Sorteio pronto e entrega pendente vêm antes dos indicadores quando
 * existem, porque são as únicas coisas aqui que ficam piores esperando.
 */

const PERIODOS = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "90", rotulo: "90 dias" },
] as const;

export function Inicio() {
  const [dias, setDias] = useState<"7" | "30" | "90">("30");
  const [menuAberto, setMenuAberto] = useState(false);

  const consulta = useInicio(Number(dias));
  const abrir = useNavegacao((estado) => estado.abrir);
  const session = useSession((estado) => estado.session);
  const empresas = useEmpresas();

  const empresaAtiva = empresas.find((e) => e.id === session?.empresaAtivaId);

  return (
    <>
      <Tela
        titulo="Início"
        subtitulo={empresaAtiva?.nomeFantasia}
        acoes={
          <BotaoIcone icone="person-circle-outline" rotulo="Sua conta" onPress={() => setMenuAberto(true)} />
        }
        aoAtualizar={consulta.refetch}
        atualizando={consulta.isFetching && !consulta.isPending}
      >
        <Seletor
          opcoes={PERIODOS}
          valor={dias}
          onChange={(valor) => setDias(valor)}
        />

        <Conteudo consulta={consulta}>
          {(resumo) => (
            <View style={{ gap: spacing.lg }}>
              <ExigeAcao resumo={resumo} />

              <Indicadores resumo={resumo} dias={Number(dias)} />

              {resumo.movimentoPorDia.some((p) => p.valor > 0) ? (
                <Secao titulo="Movimento por dia">
                  <Cartao>
                    <Grafico pontos={resumo.movimentoPorDia} />
                  </Cartao>
                </Secao>
              ) : null}

              {resumo.premiosEntregues.length > 0 ? (
                <Secao titulo="Prêmios entregues">
                  {resumo.premiosEntregues.slice(0, 4).map((premio) => (
                    <Pressable
                      key={premio.id}
                      onPress={() => abrir({ nome: "entregas" })}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver entrega de ${premio.premio}`}
                    >
                      <Cartao>
                        <View style={estilos.entreLinhas}>
                          <Icone nome="checkmark-done-outline" cor={colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Titulo nivel={3} numberOfLines={1}>
                              {premio.premio}
                            </Titulo>
                            <Apoio numberOfLines={2}>
                              {premio.cliente} · recebeu: {premio.recebedor} · {desde(premio.entregueEm)}
                            </Apoio>
                          </View>
                          <Icone nome="chevron-forward" />
                        </View>
                      </Cartao>
                    </Pressable>
                  ))}
                </Secao>
              ) : null}

              {resumo.quaseCompletando.length > 0 ? (
                <Secao titulo="Quase completando">
                  {resumo.quaseCompletando.slice(0, 5).map((item) => (
                    <Pressable
                      key={`${item.clienteId}-${item.campanhaId}`}
                      onPress={() => abrir({ nome: "cliente", id: item.clienteId })}
                      accessibilityRole="button"
                      accessibilityLabel={`Ficha de ${item.cliente}`}
                    >
                      <Cartao>
                        <View style={estilos.entreLinhas}>
                          <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
                            {item.cliente}
                          </Titulo>
                          <Selo tom="brand">
                            {item.faltam === 1 ? "falta 1" : `faltam ${item.faltam}`}
                          </Selo>
                        </View>
                        <Apoio numberOfLines={1}>
                          {item.campanha} · {item.premio}
                        </Apoio>
                        <Selos atuais={item.selosAtuais} necessarios={item.selosNecessarios} />
                        <Apoio>{telefone(item.telefone)}</Apoio>
                      </Cartao>
                    </Pressable>
                  ))}
                </Secao>
              ) : null}

              {resumo.campanhas.length > 0 ? (
                <Secao
                  titulo="Campanhas"
                  acao={
                    <Botao
                      titulo="Ver todas"
                      variante="sutil"
                      compacto
                      onPress={() => abrir({ nome: "campanhas" })}
                    />
                  }
                >
                  {resumo.campanhas.slice(0, 4).map((campanha) => (
                    <Pressable
                      key={campanha.id}
                      onPress={() => abrir({ nome: "campanha", id: campanha.id })}
                      accessibilityRole="button"
                      accessibilityLabel={campanha.premio}
                    >
                      <Cartao>
                        <View style={estilos.entreLinhas}>
                          <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
                            {campanha.premio}
                          </Titulo>
                          <Selo tom={campanha.situacao === "ATIVA" ? "success" : "neutral"}>
                            {ROTULO_SITUACAO_CAMPANHA[campanha.situacao]}
                          </Selo>
                        </View>
                        <Apoio numberOfLines={1}>{campanha.nome}</Apoio>
                        <Apoio>{plural(campanha.participantes, "participante", "participantes")}</Apoio>
                      </Cartao>
                    </Pressable>
                  ))}
                </Secao>
              ) : (
                <Vazio
                  icone="megaphone-outline"
                  titulo="Nenhuma campanha ainda"
                  descricao="Crie um cartão fidelidade ou um sorteio para o movimento começar a aparecer aqui."
                  acao={
                    <Botao
                      titulo="Nova campanha"
                      icone="add"
                      onPress={() => abrir({ nome: "campanha-form" })}
                    />
                  }
                />
              )}

              {resumo.ultimasCompras.length > 0 ? (
                <Secao titulo="Últimas compras">
                  <Cartao>
                    {resumo.ultimasCompras.slice(0, 6).map((compra, indice) => (
                      <View key={compra.id}>
                        {indice > 0 ? <Divisor style={{ marginVertical: spacing.sm }} /> : null}
                        <View style={estilos.entreLinhas}>
                          <View style={{ flex: 1 }}>
                            <Texto numberOfLines={1}>{compra.cliente}</Texto>
                            <Apoio numberOfLines={1}>
                              {compra.campanha} · {compra.beneficio}
                            </Apoio>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Texto style={{ fontVariant: ["tabular-nums"] }}>
                              {moeda(compra.valor)}
                            </Texto>
                            <Apoio>{desde(compra.quando)}</Apoio>
                          </View>
                        </View>
                      </View>
                    ))}
                  </Cartao>
                </Secao>
              ) : null}
            </View>
          )}
        </Conteudo>
      </Tela>

      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* O que exige ação                                                           */
/* -------------------------------------------------------------------------- */

function ExigeAcao({ resumo }: { resumo: ResumoInicio }) {
  const abrir = useNavegacao((estado) => estado.abrir);

  const nada =
    resumo.sorteiosProntos.length === 0 &&
    resumo.entregasPendentes.length === 0 &&
    resumo.proximosSorteios.length === 0;

  if (nada) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {resumo.sorteiosProntos.map((sorteio) => (
        <Pressable
          key={sorteio.id}
          onPress={() => abrir({ nome: "campanha", id: sorteio.id })}
          accessibilityRole="button"
          accessibilityLabel={`Sortear ${sorteio.campanha}`}
        >
          <Cartao destaque>
            <View style={estilos.entreLinhas}>
              <Icone nome="trophy-outline" cor={colors.primary} />
              <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
                {sorteio.campanha}
              </Titulo>
              <Icone nome="chevron-forward" />
            </View>
            <Apoio>
              Encerrou {desde(sorteio.encerradaEm)} e está esperando o sorteio ·{" "}
              {plural(sorteio.cupons, "cupom", "cupons")} de {sorteio.participantes} pessoas
            </Apoio>
          </Cartao>
        </Pressable>
      ))}

      {resumo.entregasPendentes.length > 0 ? (
        <Pressable
          onPress={() => abrir({ nome: "entregas" })}
          accessibilityRole="button"
          accessibilityLabel="Ver entregas pendentes"
        >
          <Cartao destaque>
            <View style={estilos.entreLinhas}>
              <Icone nome="gift-outline" cor={colors.primary} />
              <Titulo nivel={3} style={{ flex: 1 }}>
                {plural(resumo.entregasPendentes.length, "prêmio para entregar", "prêmios para entregar")}
              </Titulo>
              <Icone nome="chevron-forward" />
            </View>
            <Apoio numberOfLines={2}>
              {resumo.entregasPendentes
                .slice(0, 3)
                .map((e) => `${e.cliente} (${e.premio})`)
                .join(" · ")}
            </Apoio>
          </Cartao>
        </Pressable>
      ) : null}

      {resumo.proximosSorteios.map((sorteio) => (
        <Cartao key={sorteio.id}>
          <View style={estilos.entreLinhas}>
            <Icone nome="calendar-outline" />
            <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
              {sorteio.campanha}
            </Titulo>
          </View>
          <Apoio>
            Sorteia {desde(sorteio.sorteiaEm)} ·{" "}
            {plural(sorteio.participantes, "participante", "participantes")}
          </Apoio>
        </Cartao>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Indicadores                                                                */
/* -------------------------------------------------------------------------- */

function Indicadores({ resumo, dias }: { resumo: ResumoInicio; dias: number }) {
  return (
    <View style={estilos.grade}>
      <Indicador
        rotulo="Movimento"
        valor={moeda(resumo.movimento.valor)}
        variacaoFracao={resumo.movimento.variacao}
        dias={dias}
      />
      <Indicador
        rotulo="Clientes que compraram"
        valor={String(resumo.clientesQueCompraram.valor)}
        variacaoFracao={resumo.clientesQueCompraram.variacao}
        dias={dias}
      />
      <Indicador
        rotulo="Benefícios entregues"
        valor={String(resumo.beneficiosEntregues.valor)}
        variacaoFracao={resumo.beneficiosEntregues.variacao}
        dias={dias}
      />
      <Indicador rotulo="Campanhas no ar" valor={String(resumo.campanhasNoAr)} />
      {resumo.clientesInativos > 0 ? (
        <Indicador
          rotulo="Clientes inativos"
          valor={String(resumo.clientesInativos)}
          alerta
        />
      ) : null}
    </View>
  );
}

function Indicador({
  rotulo,
  valor,
  variacaoFracao,
  dias,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  variacaoFracao?: number;
  dias?: number;
  alerta?: boolean;
}) {
  const delta = variacao(variacaoFracao);
  const subiu = (variacaoFracao ?? 0) > 0;

  return (
    <View style={estilos.indicador}>
      <Rotulo>{rotulo}</Rotulo>
      <Numero style={alerta ? { color: colors.warningForeground } : undefined}>{valor}</Numero>
      {delta ? (
        <View style={estilos.entreLinhas}>
          <Icone
            nome={subiu ? "trending-up" : "trending-down"}
            tamanho={14}
            cor={subiu ? colors.success : colors.danger}
          />
          <Apoio style={{ color: subiu ? colors.success : colors.danger, fontSize: fontSize.xs }}>
            {delta} vs. {dias} dias antes
          </Apoio>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Gráfico                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * O movimento por dia, em barras.
 *
 * Feito com `View` e altura proporcional — nenhuma biblioteca de gráfico. Para
 * uma série de uma dimensão isso basta, e evita trazer `svg`, que é módulo
 * nativo. Só os extremos e o meio recebem rótulo: trinta datas no eixo de um
 * celular viram uma faixa cinza ilegível.
 */
function Grafico({ pontos }: { pontos: PontoDoDia[] }) {
  const maximo = Math.max(...pontos.map((p) => p.valor), 1);
  const meio = Math.floor(pontos.length / 2);
  const total = pontos.reduce((soma, ponto) => soma + ponto.valor, 0);
  const diasComMovimento = pontos.filter((ponto) => ponto.valor > 0).length;
  const media = diasComMovimento ? Math.round(total / diasComMovimento) : 0;
  const melhorDia = pontos.reduce((melhor, ponto) => (ponto.valor > melhor.valor ? ponto : melhor), pontos[0]);
  const alturaMedia = Math.max(2, (media / maximo) * 100);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={estilos.resumoGrafico}>
        <View style={estilos.itemResumoGrafico}>
          <Apoio>Total</Apoio>
          <Texto numberOfLines={1} style={estilos.valorResumoGrafico}>{moeda(total)}</Texto>
        </View>
        <View style={estilos.itemResumoGrafico}>
          <Apoio>Média/dia</Apoio>
          <Texto numberOfLines={1} style={estilos.valorResumoGrafico}>{moeda(media)}</Texto>
        </View>
        <View style={estilos.itemResumoGrafico}>
          <Apoio>Dias ativos</Apoio>
          <Texto numberOfLines={1} style={estilos.valorResumoGrafico}>{diasComMovimento}/{pontos.length}</Texto>
        </View>
        <View style={estilos.itemResumoGrafico}>
          <Apoio>Melhor dia</Apoio>
          <Texto numberOfLines={1} style={estilos.valorResumoGrafico}>{diaMes(melhorDia.dia)} · {moeda(melhorDia.valor)}</Texto>
        </View>
      </View>
      <View style={estilos.grafico}>
        <View pointerEvents="none" style={estilos.graficoEscala}>
          <Apoio style={estilos.graficoEscalaTexto}>{moeda(maximo)}</Apoio>
          <Apoio style={estilos.graficoEscalaTexto}>{moeda(Math.round(maximo / 2))}</Apoio>
          <Apoio style={estilos.graficoEscalaTexto}>R$ 0</Apoio>
        </View>
        <View style={estilos.graficoPlot}>
          {pontos.map((ponto) => (
            <View
              key={ponto.dia}
              style={[
                estilos.barra,
                {
                  height: `${Math.max(2, (ponto.valor / maximo) * 100)}%`,
                  backgroundColor: ponto.dia === melhorDia.dia ? colors.heading : ponto.valor > 0 ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
          <View pointerEvents="none" style={estilos.graficoGrade}>
            <View style={estilos.graficoLinhaGrade} />
            <View style={estilos.graficoLinhaGrade} />
            <View style={estilos.graficoLinhaGrade} />
          </View>
          <View pointerEvents="none" style={[estilos.graficoLinhaMedia, { bottom: `${alturaMedia}%` }]} />
        </View>
      </View>
      <View style={estilos.eixo}>
        <Apoio style={{ fontSize: fontSize.xs }}>{diaMes(pontos[0]?.dia)}</Apoio>
        <Apoio style={{ fontSize: fontSize.xs }}>{diaMes(pontos[meio]?.dia)}</Apoio>
        <Apoio style={{ fontSize: fontSize.xs }}>{diaMes(pontos[pontos.length - 1]?.dia)}</Apoio>
      </View>
      <Divisor />
      <Linha rotulo="Maior dia do período">{moeda(maximo)}</Linha>
      <Apoio>Linha verde: média dos dias com movimento. Barra escura: melhor dia.</Apoio>
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  indicador: {
    // Duas colunas com folga para o rótulo de duas palavras não quebrar em três.
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  entreLinhas: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resumoGrafico: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  itemResumoGrafico: {
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: colors.surfaceMuted,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  valorResumoGrafico: {
    fontWeight: "600",
  },
  grafico: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 90,
    overflow: "hidden",
  },
  graficoPlot: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    position: "relative",
    overflow: "hidden",
  },
  graficoGrade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "space-between",
    zIndex: 3,
    elevation: 3,
  },
  graficoLinhaGrade: {
    height: 2,
    backgroundColor: colors.heading,
    opacity: 0.24,
  },
  graficoEscala: {
    width: 44,
    height: "100%",
    justifyContent: "space-between",
  },
  graficoEscalaTexto: {
    fontSize: 9,
    backgroundColor: colors.background,
    paddingRight: 4,
  },
  graficoLinhaMedia: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
    opacity: 0.95,
    zIndex: 4,
    elevation: 4,
  },
  barra: {
    flex: 1,
    minWidth: 0,
  },
  eixo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 44,
  },
});
