import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Alerta,
  Apoio,
  Botao,
  Cartao,
  Confirmacao,
  Conteudo,
  Divisor,
  Linha,
  Rotulo,
  Secao,
  Selo,
  Texto,
  Titulo,
} from "../components/ui";
import { pode } from "../constants/permissoes";
import {
  useAlterarSituacaoCampanha,
  useCampanha,
  useExcluirCampanha,
  useSortear,
} from "../hooks/use-queries";
import { data, dataHora, documento, moeda, plural, telefone } from "../lib/format";
import {
  ROTULO_SITUACAO_CAMPANHA,
  ROTULO_TIPO_CAMPANHA,
  ROTULO_TRANSICAO,
  type Campanha,
  type Sorteio,
} from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useUsuario } from "../stores/session";
import { colors, spacing } from "../theme";
import { TOM_DA_SITUACAO } from "./Campanhas";

/**
 * O detalhe da campanha.
 *
 * As transições de situação não são inventadas aqui: o servidor manda
 * `proximasSituacoes` em cada campanha, e a tela só desenha um botão por item
 * dessa lista. Isso significa que a regra de "encerrada não volta para ativa"
 * vive num lugar só — e o app nunca oferece um botão que o servidor vai recusar.
 */
export function CampanhaDetalhe({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const consulta = useCampanha(id);
  const abrir = useNavegacao((estado) => estado.abrir);
  const usuario = useUsuario();

  const podeGerenciar = pode(usuario, "campanhas.gerenciar");
  const podeSortearPermissao = pode(usuario, "campanhas.sortear");

  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [confirmarSorteio, setConfirmarSorteio] = useState(false);

  const alterarSituacao = useAlterarSituacaoCampanha();
  const excluir = useExcluirCampanha(() => {
    setConfirmarExclusao(false);
    aoVoltar();
  });
  const sortear = useSortear(() => setConfirmarSorteio(false));

  return (
    <Tela
      titulo="Campanha"
      aoVoltar={aoVoltar}
      aoAtualizar={consulta.refetch}
      atualizando={consulta.isFetching && !consulta.isPending}
    >
      <Conteudo consulta={consulta}>
        {(detalhe) => {
          const { campanha } = detalhe;
          const ehSorteio = campanha.tipo === "SORTEIO";

          return (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <View style={estilos.topo}>
                  <Titulo nivel={1} style={{ flex: 1 }}>
                    {campanha.nome}
                  </Titulo>
                  <Selo tom={TOM_DA_SITUACAO[campanha.situacao]}>
                    {ROTULO_SITUACAO_CAMPANHA[campanha.situacao]}
                  </Selo>
                </View>
                <Apoio>{ROTULO_TIPO_CAMPANHA[campanha.tipo]}</Apoio>
                {campanha.descricao ? <Texto>{campanha.descricao}</Texto> : null}
              </View>

              {campanha.podeSortear && podeSortearPermissao ? (
                <Alerta
                  tom="atencao"
                  icone="trophy-outline"
                  titulo="Pronta para sortear"
                  descricao="A campanha encerrou e os cupons estão fechados. O sorteio gera um hash da lista, que é o que permite conferir o resultado depois."
                />
              ) : null}

              <Secao titulo="Como funciona">
                <Cartao>
                  <Texto>{campanha.regraEmUmaFrase}</Texto>
                  <Divisor />
                  {campanha.regra.selosNecessarios !== undefined ? (
                    <Linha rotulo="Selos para completar">{campanha.regra.selosNecessarios}</Linha>
                  ) : null}
                  {campanha.regra.valorPorCupom !== undefined ? (
                    <Linha rotulo="Valor por cupom">{moeda(campanha.regra.valorPorCupom)}</Linha>
                  ) : null}
                  {campanha.regra.valorMinimoCompra !== undefined ? (
                    <Linha rotulo="Compra mínima">{moeda(campanha.regra.valorMinimoCompra)}</Linha>
                  ) : null}
                  {campanha.regra.quantidadeGanhadores !== undefined ? (
                    <Linha rotulo="Ganhadores">{campanha.regra.quantidadeGanhadores}</Linha>
                  ) : null}
                  {campanha.regra.limiteTotalCupons !== undefined ? (
                    <Linha rotulo="Limite total de cupons">{campanha.regra.limiteTotalCupons}</Linha>
                  ) : null}
                  {campanha.regra.limiteDiarioCliente !== undefined ? (
                    <Linha rotulo="Limite por cliente/dia">{campanha.regra.limiteDiarioCliente}</Linha>
                  ) : null}
                </Cartao>
              </Secao>

              {campanha.premio ? (
                <Secao titulo="Prêmio">
                  <Cartao>
                    <Titulo nivel={3}>{campanha.premio.nome}</Titulo>
                    {campanha.premio.descricao ? <Apoio>{campanha.premio.descricao}</Apoio> : null}
                    <Divisor />
                    <Linha rotulo="Disponível">
                      {campanha.premio.quantidadeDisponivel} de {campanha.premio.quantidadeTotal}
                    </Linha>
                    <Linha rotulo="Já entregue">{campanha.premio.quantidadeEntregue}</Linha>
                    {campanha.premio.estoqueBaixo ? (
                      <Selo tom="warning">Estoque baixo</Selo>
                    ) : null}
                    {campanha.premio.instrucoesRetirada ? (
                      <>
                        <Divisor />
                        <Rotulo>Como retirar</Rotulo>
                        <Texto>{campanha.premio.instrucoesRetirada}</Texto>
                      </>
                    ) : null}
                  </Cartao>
                </Secao>
              ) : null}

              <Secao titulo="Números">
                <Cartao>
                  <Linha rotulo="Participantes">{campanha.totalParticipantes}</Linha>
                  <Linha rotulo="Lançamentos">{campanha.totalLancamentos}</Linha>
                  <Linha rotulo="Movimentado">{moeda(campanha.valorMovimentado)}</Linha>
                  <Linha rotulo={ehSorteio ? "Cupons gerados" : "Selos dados"}>
                    {detalhe.totalBeneficios}
                  </Linha>
                  <Divisor />
                  <Linha rotulo="Começa">{data(campanha.iniciaEm)}</Linha>
                  <Linha rotulo="Termina">{data(campanha.terminaEm)}</Linha>
                  {campanha.sorteiaEm ? <Linha rotulo="Sorteia">{data(campanha.sorteiaEm)}</Linha> : null}
                </Cartao>
                <Botao
                  titulo="Ver participantes"
                  variante="secundario"
                  icone="people-outline"
                  largura="cheia"
                  onPress={() => abrir({ nome: "participantes", id: campanha.id })}
                />
              </Secao>

              {detalhe.sorteio ? <ResultadoDoSorteio sorteio={detalhe.sorteio} /> : null}

              {podeGerenciar || podeSortearPermissao ? (
                <Acoes
                  campanha={campanha}
                  podeGerenciar={podeGerenciar}
                  podeSortear={podeSortearPermissao}
                  alterando={alterarSituacao.isPending}
                  aoAlterar={(situacao) => alterarSituacao.mutate({ id: campanha.id, situacao })}
                  aoEditar={() => abrir({ nome: "campanha-form", id: campanha.id })}
                  aoSortear={() => setConfirmarSorteio(true)}
                  aoExcluir={() => setConfirmarExclusao(true)}
                />
              ) : null}

              <Confirmacao
                visivel={confirmarSorteio}
                titulo="Realizar o sorteio?"
                aoFechar={() => setConfirmarSorteio(false)}
                rodape={
                  <>
                    <Botao
                      titulo="Cancelar"
                      variante="secundario"
                      onPress={() => setConfirmarSorteio(false)}
                    />
                    <Botao
                      titulo="Sortear"
                      onPress={() => sortear.mutate(campanha.id)}
                      carregando={sortear.isPending}
                    />
                  </>
                }
              >
                <Texto>
                  O sorteio é definitivo: registra o ganhador, gera o hash da lista de
                  cupons e cria a entrega do prêmio.
                </Texto>
                <Apoio>
                  {plural(campanha.totalParticipantes, "participante concorre", "participantes concorrem")}.
                </Apoio>
              </Confirmacao>

              <Confirmacao
                visivel={confirmarExclusao}
                titulo="Excluir a campanha?"
                aoFechar={() => setConfirmarExclusao(false)}
                rodape={
                  <>
                    <Botao
                      titulo="Manter"
                      variante="secundario"
                      onPress={() => setConfirmarExclusao(false)}
                    />
                    <Botao
                      titulo="Excluir"
                      variante="perigo"
                      onPress={() => excluir.mutate(campanha.id)}
                      carregando={excluir.isPending}
                    />
                  </>
                }
              >
                <Texto>
                  &quot;{campanha.nome}&quot; sai da lista para sempre. Só dá para excluir
                  campanha sem lançamento — se já houver compra registrada, encerre em vez
                  de excluir.
                </Texto>
              </Confirmacao>
            </View>
          );
        }}
      </Conteudo>
    </Tela>
  );
}

/* -------------------------------------------------------------------------- */
/* Ações                                                                      */
/* -------------------------------------------------------------------------- */

function Acoes({
  campanha,
  podeGerenciar,
  podeSortear,
  alterando,
  aoAlterar,
  aoEditar,
  aoSortear,
  aoExcluir,
}: {
  campanha: Campanha;
  podeGerenciar: boolean;
  podeSortear: boolean;
  alterando: boolean;
  aoAlterar: (situacao: Campanha["situacao"]) => void;
  aoEditar: () => void;
  aoSortear: () => void;
  aoExcluir: () => void;
}) {
  // `SORTEADA` sai da lista de transições comuns: sortear não é trocar de estado,
  // é uma operação que produz resultado, e tem confirmação própria.
  const transicoes = campanha.proximasSituacoes.filter((s) => s !== "SORTEADA");

  return (
    <Secao titulo="Ações">
      <View style={{ gap: spacing.sm }}>
        {podeGerenciar
          ? transicoes.map((situacao) => (
              <Botao
                key={situacao}
                titulo={ROTULO_TRANSICAO[situacao]}
                variante={situacao === "ENCERRADA" ? "secundario" : "primario"}
                largura="cheia"
                carregando={alterando}
                onPress={() => aoAlterar(situacao)}
              />
            ))
          : null}

        {campanha.podeSortear && podeSortear ? (
          <Botao titulo="Realizar sorteio" icone="trophy-outline" largura="cheia" onPress={aoSortear} />
        ) : null}

        {podeGerenciar ? (
          <Botao
            titulo="Editar campanha"
            variante="secundario"
            icone="create-outline"
            largura="cheia"
            onPress={aoEditar}
          />
        ) : null}

        {podeGerenciar && campanha.totalLancamentos === 0 ? (
          <Botao
            titulo="Excluir campanha"
            variante="perigo"
            icone="trash-outline"
            largura="cheia"
            onPress={aoExcluir}
          />
        ) : null}
      </View>
    </Secao>
  );
}

/* -------------------------------------------------------------------------- */
/* Resultado do sorteio                                                       */
/* -------------------------------------------------------------------------- */

function ResultadoDoSorteio({ sorteio }: { sorteio: Sorteio }) {
  return (
    <Secao titulo="Resultado do sorteio">
      <Cartao destaque>
        <Linha rotulo="Realizado em">{dataHora(sorteio.realizadoEm)}</Linha>
        <Linha rotulo="Participantes">{sorteio.totalParticipantes}</Linha>
        <Linha rotulo="Cupons">{sorteio.totalCupons}</Linha>
        <Divisor />

        <Rotulo>{plural(sorteio.ganhadores.length, "Ganhador", "Ganhadores")}</Rotulo>
        {sorteio.ganhadores.map((ganhador) => (
          <View key={ganhador.clienteId} style={estilos.ganhador}>
            <View style={{ flex: 1 }}>
              <Texto numberOfLines={1}>
                {ganhador.posicao}º · {ganhador.nome}
              </Texto>
              <Apoio>
                {documento(ganhador.documento)} · {telefone(ganhador.telefone)}
              </Apoio>
            </View>
            <Selo tom="brand">{ganhador.numeroCupom}</Selo>
          </View>
        ))}

        <Divisor />
        {/* O hash é o que torna o sorteio conferível: quem guardou a lista de
            cupons pode recalcular e comparar. Fica visível por isso. */}
        <Rotulo>Hash da lista</Rotulo>
        <Texto style={estilos.hash} numberOfLines={2}>
          {sorteio.hashLista}
        </Texto>
        <Apoio>
          Identifica a lista de cupons no momento do sorteio. Serve para conferir o
          resultado depois.
        </Apoio>
      </Cartao>
    </Secao>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  ganhador: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hash: {
    fontSize: 12,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
});
