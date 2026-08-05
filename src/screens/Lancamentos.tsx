import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Alerta,
  Apoio,
  Botao,
  BotaoIcone,
  Busca,
  Cartao,
  Conteudo,
  Divisor,
  Filtros,
  Linha,
  Paginacao,
  Rotulo,
  Secao,
  Selo,
  Seletor,
  SemPermissao,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { pode } from "../constants/permissoes";
import { useAuditoria } from "../hooks/use-queries";
import { dataHora, moeda, plural } from "../lib/format";
import { ROTULO_PERFIL, type ResumoPorPessoa } from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useUsuario } from "../stores/session";
import { colors, spacing } from "../theme";

/**
 * Lançamentos e auditoria.
 *
 * Duas leituras na mesma tela: o resumo por pessoa, que responde "alguém está
 * fazendo algo estranho", e as linhas, que respondem "o que exatamente
 * aconteceu". O resumo vem primeiro porque é o que se olha sem motivo específico;
 * as linhas, quando já se sabe o que procurar.
 *
 * Os sinais não acusam ninguém — o texto do servidor diz o que foi observado e
 * também o que pode explicá-lo sem má-fé. Repetimos os dois lados aqui em vez de
 * mostrar só o alerta, porque um sinal lido pela metade vira acusação.
 */

const PERIODOS = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "90", rotulo: "90 dias" },
] as const;

export function Lancamentos() {
  const usuario = useUsuario();
  const [dias, setDias] = useState<"7" | "30" | "90">("30");
  const [busca, setBusca] = useState("");
  const [funcionario, setFuncionario] = useState<string | undefined>();
  const [apenasMarcados, setApenasMarcados] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [menuAberto, setMenuAberto] = useState(false);

  const abrir = useNavegacao((estado) => estado.abrir);
  const permitido = pode(usuario, "auditoria.ver");

  const consulta = useAuditoria({
    dias: Number(dias),
    busca: busca.trim() || undefined,
    funcionario,
    apenasMarcados: apenasMarcados || undefined,
    pagina,
    tamanho: 20,
  });

  if (!permitido) {
    return (
      <Tela titulo="Lançamentos">
        <SemPermissao />
      </Tela>
    );
  }

  return (
    <>
      <Tela
        titulo="Lançamentos"
        acoes={
          <BotaoIcone
            icone="person-circle-outline"
            rotulo="Sua conta"
            onPress={() => setMenuAberto(true)}
          />
        }
        aoAtualizar={consulta.refetch}
        atualizando={consulta.isFetching && !consulta.isPending}
      >
        <View style={{ gap: spacing.sm }}>
          <Seletor
            opcoes={PERIODOS}
            valor={dias}
            onChange={(v) => {
              setDias(v);
              setPagina(1);
            }}
          />
          <Busca
            valor={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Cliente, código ou campanha"
          />
          <Filtros
            opcoes={[{ valor: "marcados", rotulo: "Só o que chamou atenção" }]}
            selecionados={apenasMarcados ? ["marcados"] : []}
            onChange={(sel) => {
              setApenasMarcados(sel.length > 0);
              setPagina(1);
            }}
          />
        </View>

        <Conteudo consulta={consulta}>
          {(relatorio) => (
            <View style={{ gap: spacing.lg }}>
              {relatorio.resumo.length > 0 ? (
                <Secao titulo={`Por pessoa · ${relatorio.janelaEmDias} dias`}>
                  {/* Filtrar por funcionário é o caminho natural depois de ver um
                      sinal: toca-se no cartão da pessoa e as linhas abaixo passam
                      a ser só dela. */}
                  {funcionario ? (
                    <Botao
                      titulo="Ver todos de novo"
                      variante="sutil"
                      compacto
                      icone="close"
                      onPress={() => {
                        setFuncionario(undefined);
                        setPagina(1);
                      }}
                    />
                  ) : null}

                  {relatorio.resumo.map((pessoa) => (
                    <CartaoDePessoa
                      key={pessoa.usuarioId}
                      pessoa={pessoa}
                      selecionada={pessoa.usuarioId === funcionario}
                      onPress={() => {
                        setFuncionario(
                          pessoa.usuarioId === funcionario ? undefined : pessoa.usuarioId,
                        );
                        setPagina(1);
                      }}
                    />
                  ))}
                </Secao>
              ) : null}

              <Secao titulo={`Lançamentos (${relatorio.linhas.totalElements})`}>
                {relatorio.linhas.content.length === 0 ? (
                  <Vazio
                    icone="clipboard-outline"
                    titulo="Nenhum lançamento no período"
                    descricao="Amplie o período ou limpe os filtros."
                  />
                ) : (
                  <>
                    {relatorio.linhas.content.map((linha) => {
                      const cancelado = linha.lancamento.situacao === "CANCELADO";
                      return (
                        <Cartao key={linha.lancamento.id}>
                          <View style={estilos.topo}>
                            <View style={{ flex: 1 }}>
                              <Texto numberOfLines={1}>{linha.cliente}</Texto>
                              <Apoio numberOfLines={1}>{linha.campanha}</Apoio>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                              <Texto
                                style={[
                                  { fontVariant: ["tabular-nums"] },
                                  cancelado && estilos.riscado,
                                ]}
                              >
                                {moeda(linha.lancamento.valorCompra)}
                              </Texto>
                              {cancelado ? <Selo tom="danger">Cancelada</Selo> : null}
                            </View>
                          </View>

                          <Divisor />
                          <Linha rotulo="Quem lançou">{linha.usuario}</Linha>
                          <Linha rotulo="Quando">{dataHora(linha.lancamento.criadoEm)}</Linha>
                          <Linha rotulo="Código">
                            <Texto style={{ fontVariant: ["tabular-nums"] }}>
                              {linha.lancamento.codigo}
                            </Texto>
                          </Linha>
                          <Linha rotulo="Benefício">
                            {plural(
                              linha.lancamento.quantidadeBeneficio,
                              linha.lancamento.tipoBeneficio === "SELOS" ? "selo" : "cupom",
                              linha.lancamento.tipoBeneficio === "SELOS" ? "selos" : "cupons",
                            )}
                          </Linha>

                          {cancelado && linha.lancamento.motivoCancelamento ? (
                            <Apoio>Motivo: {linha.lancamento.motivoCancelamento}</Apoio>
                          ) : null}

                          {linha.marcas.length > 0 ? (
                            <View style={estilos.marcas}>
                              {linha.marcas.map((marca) => (
                                <Selo key={marca} tom="warning">
                                  {marca}
                                </Selo>
                              ))}
                            </View>
                          ) : null}

                          <Botao
                            titulo="Ver ficha do cliente"
                            variante="sutil"
                            compacto
                            onPress={() => abrir({ nome: "cliente", id: linha.lancamento.clienteId })}
                          />
                        </Cartao>
                      );
                    })}
                    <Paginacao pagina={relatorio.linhas} onChange={setPagina} />
                  </>
                )}
              </Secao>
            </View>
          )}
        </Conteudo>
      </Tela>

      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

function CartaoDePessoa({
  pessoa,
  selecionada,
  onPress,
}: {
  pessoa: ResumoPorPessoa;
  selecionada: boolean;
  onPress: () => void;
}) {
  const temAlerta = pessoa.sinais.some((s) => s.gravidade === "ALERTA");

  return (
    <Cartao
      destaque={temAlerta}
      style={selecionada ? { borderColor: colors.primary, borderWidth: 2 } : undefined}
    >
      <View style={estilos.topo}>
        <View style={{ flex: 1 }}>
          <Titulo nivel={3} numberOfLines={1}>
            {pessoa.nome}
          </Titulo>
          <Apoio>
            {ROTULO_PERFIL[pessoa.perfil]}
            {pessoa.situacao === "INATIVO" ? " · sem acesso" : ""}
          </Apoio>
        </View>
        <Selo tom={selecionada ? "brand" : "neutral"}>{selecionada ? "Filtrando" : "Filtrar"}</Selo>
      </View>

      <Divisor />
      <Linha rotulo="Confirmados">{pessoa.confirmados}</Linha>
      {pessoa.cancelados > 0 ? <Linha rotulo="Cancelados">{pessoa.cancelados}</Linha> : null}
      <Linha rotulo="Valor total">{moeda(pessoa.valorTotal)}</Linha>
      <Linha rotulo="Clientes distintos">{pessoa.clientesDistintos}</Linha>
      {pessoa.clienteMaisAtendido ? (
        <Linha rotulo="Mais atendido">
          <View style={{ alignItems: "flex-end" }}>
            <Texto numberOfLines={1}>{pessoa.clienteMaisAtendido}</Texto>
            <Apoio>{plural(pessoa.vezesNoMesmoCliente, "vez", "vezes")}</Apoio>
          </View>
        </Linha>
      ) : null}

      {pessoa.sinais.length > 0 ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <Rotulo>O que chamou atenção</Rotulo>
          {pessoa.sinais.map((sinal) => (
            <Alerta
              key={sinal.id}
              tom={sinal.gravidade === "ALERTA" ? "perigo" : "atencao"}
              titulo={sinal.rotulo}
              descricao={sinal.detalhe}
            />
          ))}
        </View>
      ) : null}

      <Botao
        titulo={selecionada ? "Mostrar todos" : "Ver só os lançamentos dela"}
        variante="sutil"
        compacto
        onPress={onPress}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  riscado: {
    textDecorationLine: "line-through",
  },
  marcas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
