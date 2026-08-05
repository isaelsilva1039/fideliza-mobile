import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Botao,
  Campo,
  Cartao,
  Confirmacao,
  Conteudo,
  Divisor,
  Folha,
  Linha,
  Rotulo,
  Secao,
  Selo,
  Selos,
  Seletor,
  Texto,
  Titulo,
} from "../components/ui";
import { pode } from "../constants/permissoes";
import { useCancelarLancamento, useEditarCliente, useFichaCliente } from "../hooks/use-queries";
import {
  data,
  dataHora,
  desde,
  documento as formatarDocumento,
  moeda,
  plural,
  telefone as formatarTelefone,
} from "../lib/format";
import {
  ROTULO_SITUACAO_CAMPANHA,
  ROTULO_SITUACAO_ENTREGA,
  type Cliente,
  type FichaCliente,
  type Lancamento,
  type SituacaoCliente,
} from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useUsuario } from "../stores/session";
import { spacing, type Tone } from "../theme";

/**
 * A ficha do cliente.
 *
 * Vem numa consulta só, e é assim de propósito: são quatro listas curtas, e
 * quebrá-las em quatro chamadas faria a ficha abrir em quatro etapas, piscando —
 * e ela é aberta com o cliente na frente.
 *
 * O documento aqui vem inteiro, diferente da listagem, que o mascara. É o que
 * permite conferir com o documento na mão.
 */

const TOM_ENTREGA: Record<string, Tone> = {
  AGUARDANDO: "warning",
  ENTREGUE: "success",
  CANCELADA: "neutral",
};

export function ClienteFicha({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const consulta = useFichaCliente(id);
  const abrir = useNavegacao((estado) => estado.abrir);
  const usuario = useUsuario();

  const podeGerenciar = pode(usuario, "clientes.gerenciar");
  const podeAuditar = pode(usuario, "auditoria.ver");

  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [cancelar, setCancelar] = useState<Lancamento | null>(null);

  return (
    <>
      <Tela
        titulo="Ficha do cliente"
        aoVoltar={aoVoltar}
        aoAtualizar={consulta.refetch}
        atualizando={consulta.isFetching && !consulta.isPending}
        rodape={
          <Botao
            titulo="Registrar compra"
            icone="cart-outline"
            largura="cheia"
            onPress={() => abrir({ nome: "registrar-compra", clienteId: id })}
            style={{ flex: 1 }}
          />
        }
      >
        <Conteudo consulta={consulta}>
          {(ficha) => (
            <View style={{ gap: spacing.lg }}>
              <Cadastro
                ficha={ficha}
                podeGerenciar={podeGerenciar}
                aoEditar={() => setEdicaoAberta(true)}
              />

              {ficha.cartoes.length > 0 ? (
                <Secao titulo="Cartões de selo">
                  {ficha.cartoes.map((cartao) => {
                    const completo = cartao.selosAtuais >= cartao.selosNecessarios;
                    return (
                      <Cartao key={cartao.campanhaId} destaque={completo}>
                        <View style={estilos.topo}>
                          <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
                            {cartao.campanha}
                          </Titulo>
                          {completo ? <Selo tom="success">Completo</Selo> : null}
                        </View>
                        <Apoio>Prêmio: {cartao.premio}</Apoio>
                        <Selos atuais={cartao.selosAtuais} necessarios={cartao.selosNecessarios} />
                        {cartao.faltam > 0 ? (
                          <Apoio>
                            {cartao.faltam === 1 ? "Falta 1 selo" : `Faltam ${cartao.faltam} selos`}
                          </Apoio>
                        ) : null}
                        {cartao.vezesCompletado > 0 ? (
                          <Apoio>
                            Já completou {plural(cartao.vezesCompletado, "vez", "vezes")}.
                          </Apoio>
                        ) : null}
                      </Cartao>
                    );
                  })}
                </Secao>
              ) : null}

              {ficha.sorteios.length > 0 ? (
                <Secao titulo="Sorteios">
                  {ficha.sorteios.map((sorteio) => (
                    <Cartao key={sorteio.campanhaId}>
                      <View style={estilos.topo}>
                        <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
                          {sorteio.campanha}
                        </Titulo>
                        <Selo tom={sorteio.situacao === "ATIVA" ? "success" : "neutral"}>
                          {ROTULO_SITUACAO_CAMPANHA[sorteio.situacao]}
                        </Selo>
                      </View>
                      <Apoio>Prêmio: {sorteio.premio}</Apoio>
                      <Linha rotulo="Cupons">
                        <Texto style={{ fontVariant: ["tabular-nums"] }}>{sorteio.cupons}</Texto>
                      </Linha>
                    </Cartao>
                  ))}
                </Secao>
              ) : null}

              {ficha.premios.length > 0 ? (
                <Secao titulo="Prêmios">
                  {ficha.premios.map((premio) => (
                    <Cartao key={premio.id} destaque={premio.situacao === "AGUARDANDO"}>
                      <View style={estilos.topo}>
                        <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
                          {premio.premio}
                        </Titulo>
                        <Selo tom={TOM_ENTREGA[premio.situacao] ?? "neutral"}>
                          {ROTULO_SITUACAO_ENTREGA[premio.situacao]}
                        </Selo>
                      </View>
                      <Apoio>{premio.campanha}</Apoio>
                      <Divisor />
                      <Linha rotulo="Código">
                        <Texto style={{ fontVariant: ["tabular-nums"] }}>{premio.codigo}</Texto>
                      </Linha>
                      <Linha rotulo="Solicitado">{data(premio.solicitadoEm)}</Linha>
                      {premio.entregueEm ? (
                        <Linha rotulo="Entregue">{data(premio.entregueEm)}</Linha>
                      ) : null}
                    </Cartao>
                  ))}
                </Secao>
              ) : null}

              {ficha.compras.length > 0 ? (
                <Secao titulo={`Compras (${ficha.compras.length})`}>
                  {ficha.compras.map(({ lancamento, campanha }) => {
                    const cancelado = lancamento.situacao === "CANCELADO";
                    return (
                      <Cartao key={lancamento.id}>
                        <View style={estilos.topo}>
                          <View style={{ flex: 1 }}>
                            <Texto numberOfLines={1}>{campanha}</Texto>
                            <Apoio>
                              {lancamento.codigo} · {dataHora(lancamento.criadoEm)}
                            </Apoio>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                            <Texto
                              style={[
                                { fontVariant: ["tabular-nums"] },
                                cancelado && estilos.riscado,
                              ]}
                            >
                              {moeda(lancamento.valorCompra)}
                            </Texto>
                            {cancelado ? <Selo tom="danger">Cancelada</Selo> : null}
                          </View>
                        </View>

                        <Apoio>
                          {plural(
                            lancamento.quantidadeBeneficio,
                            lancamento.tipoBeneficio === "SELOS" ? "selo" : "cupom",
                            lancamento.tipoBeneficio === "SELOS" ? "selos" : "cupons",
                          )}
                        </Apoio>

                        {cancelado && lancamento.motivoCancelamento ? (
                          <Apoio>Motivo: {lancamento.motivoCancelamento}</Apoio>
                        ) : null}

                        {/* Cancelar lançamento é ação de auditoria: remove o
                            benefício já dado, então fica atrás da mesma permissão
                            que vê os lançamentos. */}
                        {!cancelado && podeAuditar ? (
                          <Botao
                            titulo="Cancelar compra"
                            variante="sutil"
                            compacto
                            onPress={() => setCancelar(lancamento)}
                          />
                        ) : null}
                      </Cartao>
                    );
                  })}
                </Secao>
              ) : (
                <Secao titulo="Compras">
                  <Cartao>
                    <Apoio>Nenhuma compra registrada ainda.</Apoio>
                  </Cartao>
                </Secao>
              )}
            </View>
          )}
        </Conteudo>
      </Tela>

      {consulta.data ? (
        <EdicaoCliente
          visivel={edicaoAberta}
          cliente={consulta.data.cliente}
          aoFechar={() => setEdicaoAberta(false)}
        />
      ) : null}

      <CancelarCompra lancamento={cancelar} aoFechar={() => setCancelar(null)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Cadastro                                                                   */
/* -------------------------------------------------------------------------- */

function Cadastro({
  ficha,
  podeGerenciar,
  aoEditar,
}: {
  ficha: FichaCliente;
  podeGerenciar: boolean;
  aoEditar: () => void;
}) {
  const { cliente } = ficha;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={estilos.topo}>
        <Titulo nivel={1} style={{ flex: 1 }}>
          {cliente.nome}
        </Titulo>
        {cliente.situacao === "INATIVO" ? <Selo tom="neutral">Inativo</Selo> : null}
      </View>

      <Cartao>
        <Linha rotulo="Documento">{formatarDocumento(cliente.documento)}</Linha>
        <Linha rotulo="Telefone">{formatarTelefone(cliente.telefone)}</Linha>
        {cliente.email ? <Linha rotulo="E-mail">{cliente.email}</Linha> : null}
        <Divisor />
        <Linha rotulo="Cartão">
          <Texto style={{ fontVariant: ["tabular-nums"] }}>{cliente.codigoCartao}</Texto>
        </Linha>
        <Linha rotulo="Total gasto">{moeda(cliente.totalGasto)}</Linha>
        <Linha rotulo="Cliente desde">{data(cliente.criadoEm)}</Linha>
        <Linha rotulo="Última atividade">{desde(cliente.ultimaAtividadeEm)}</Linha>
      </Cartao>

      {podeGerenciar ? (
        <Botao
          titulo="Editar cadastro"
          variante="secundario"
          icone="create-outline"
          largura="cheia"
          onPress={aoEditar}
        />
      ) : null}
    </View>
  );
}

function EdicaoCliente({
  visivel,
  cliente,
  aoFechar,
}: {
  visivel: boolean;
  cliente: Cliente;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(cliente.nome);
  const [telefone, setTelefone] = useState(formatarTelefone(cliente.telefone));
  const [email, setEmail] = useState(cliente.email ?? "");
  const [situacao, setSituacao] = useState<SituacaoCliente>(cliente.situacao);

  // Reabrir a folha depois de salvar tem de mostrar o que o servidor tem, não o
  // que estava digitado na abertura anterior.
  useEffect(() => {
    if (!visivel) return;
    setNome(cliente.nome);
    setTelefone(formatarTelefone(cliente.telefone));
    setEmail(cliente.email ?? "");
    setSituacao(cliente.situacao);
  }, [visivel, cliente]);

  const editar = useEditarCliente(aoFechar);

  return (
    <Folha
      visivel={visivel}
      titulo="Editar cadastro"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Cancelar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
          <Botao
            titulo="Salvar"
            onPress={() =>
              editar.mutate({
                id: cliente.id,
                nome: nome.trim(),
                telefone: telefone.replace(/\D/g, ""),
                email: email.trim() || undefined,
                situacao,
              })
            }
            carregando={editar.isPending}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Campo rotulo="Nome" valor={nome} onChange={setNome} autoCapitalize="words" />
      <Campo
        rotulo="Telefone"
        valor={telefone}
        onChange={(v) => setTelefone(formatarTelefone(v))}
        teclado="phone-pad"
        maxLength={16}
      />
      <Campo
        rotulo="E-mail (opcional)"
        valor={email}
        onChange={setEmail}
        teclado="email-address"
        autoCapitalize="none"
      />

      <Seletor
        rotulo="Situação"
        opcoes={[
          { valor: "ATIVO", rotulo: "Ativo" },
          { valor: "INATIVO", rotulo: "Inativo", dica: "Não participa de novas campanhas." },
        ]}
        valor={situacao}
        onChange={setSituacao}
        coluna
      />

      <Apoio>
        O documento não muda: é ele que identifica a pessoa nas campanhas e no
        portal. Documento errado exige um cadastro novo.
      </Apoio>
    </Folha>
  );
}

/* -------------------------------------------------------------------------- */
/* Cancelar compra                                                            */
/* -------------------------------------------------------------------------- */

function CancelarCompra({
  lancamento,
  aoFechar,
}: {
  lancamento: Lancamento | null;
  aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const cancelar = useCancelarLancamento();

  useEffect(() => {
    if (lancamento) setMotivo("");
  }, [lancamento]);

  return (
    <Confirmacao
      visivel={lancamento !== null}
      titulo="Cancelar a compra?"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Manter" variante="secundario" onPress={aoFechar} />
          <Botao
            titulo="Cancelar compra"
            variante="perigo"
            desabilitado={motivo.trim().length < 3}
            carregando={cancelar.isPending}
            onPress={() => {
              if (!lancamento) return;
              cancelar.mutate(
                { id: lancamento.id, motivo: motivo.trim() },
                { onSuccess: aoFechar },
              );
            }}
          />
        </>
      }
    >
      <Texto>
        O benefício volta atrás: os{" "}
        {lancamento
          ? plural(
              lancamento.quantidadeBeneficio,
              lancamento.tipoBeneficio === "SELOS" ? "selo" : "cupom",
              lancamento.tipoBeneficio === "SELOS" ? "selos" : "cupons",
            )
          : "benefícios"}{" "}
        saem do cartão do cliente.
      </Texto>
      <Campo
        rotulo="Motivo"
        valor={motivo}
        onChange={setMotivo}
        placeholder="Compra cancelada no caixa"
        multilinha
        dica="Fica registrado na auditoria, junto de quem cancelou."
      />
    </Confirmacao>
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
});
