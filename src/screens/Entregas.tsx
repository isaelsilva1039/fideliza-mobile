import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Botao,
  BotaoIcone,
  Busca,
  Campo,
  Cartao,
  Confirmacao,
  Conteudo,
  Divisor,
  Filtros,
  Folha,
  Linha,
  Paginacao,
  Rotulo,
  Secao,
  Selo,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { useCancelarEntrega, useEntregar, useEntregas } from "../hooks/use-queries";
import { data, desde, telefone as formatarTelefone } from "../lib/format";
import { ROTULO_SITUACAO_ENTREGA, type Entrega, type SituacaoEntrega } from "../services/contrato";
import { spacing, type Tone } from "../theme";

/**
 * As entregas.
 *
 * Abre filtrada em "aguardando" — e é a única listagem do app que abre com filtro
 * aplicado. A razão é que a pergunta desta tela é sempre "o que eu tenho para
 * entregar agora", e entregas já concluídas somam centenas com o tempo. O filtro
 * fica visível e marcado, então quem quiser o histórico vê onde desmarcar.
 */

const SITUACOES: Array<{ valor: SituacaoEntrega; rotulo: string }> = [
  { valor: "AGUARDANDO", rotulo: "Aguardando" },
  { valor: "ENTREGUE", rotulo: "Entregues" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
];

const TOM: Record<SituacaoEntrega, Tone> = {
  AGUARDANDO: "warning",
  ENTREGUE: "success",
  CANCELADA: "neutral",
};

export function Entregas() {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoEntrega[]>(["AGUARDANDO"]);
  const [pagina, setPagina] = useState(1);
  const [entregar, setEntregar] = useState<Entrega | null>(null);
  const [cancelar, setCancelar] = useState<Entrega | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  const consulta = useEntregas({
    busca: busca.trim() || undefined,
    situacao: situacao.length > 0 ? situacao : undefined,
    pagina,
    tamanho: 20,
  });

  return (
    <>
      <Tela
        titulo="Entregas"
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
          <Busca
            valor={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Cliente, código ou prêmio"
          />
          <Filtros
            opcoes={SITUACOES}
            selecionados={situacao}
            onChange={(v) => {
              setSituacao(v);
              setPagina(1);
            }}
          />
        </View>

        <Conteudo
          consulta={consulta}
          vazio={(dados) => dados.content.length === 0}
          aoVazio={
            <Vazio
              icone="gift-outline"
              titulo={
                situacao.length === 1 && situacao[0] === "AGUARDANDO"
                  ? "Nada para entregar"
                  : "Nenhuma entrega com esse filtro"
              }
              descricao={
                situacao.length === 1 && situacao[0] === "AGUARDANDO"
                  ? "Quando um cliente completar o cartão ou ganhar um sorteio, o prêmio aparece aqui."
                  : "Tente outro termo ou outro filtro de situação."
              }
            />
          }
        >
          {(dados) => (
            <Secao titulo={`${dados.totalElements} no total`}>
              {dados.content.map((entrega) => (
                <ItemDeEntrega
                  key={entrega.id}
                  entrega={entrega}
                  aoEntregar={() => setEntregar(entrega)}
                  aoCancelar={() => setCancelar(entrega)}
                />
              ))}
              <Paginacao pagina={dados} onChange={setPagina} />
            </Secao>
          )}
        </Conteudo>
      </Tela>

      <FolhaDeEntrega entrega={entregar} aoFechar={() => setEntregar(null)} />
      <CancelamentoDeEntrega entrega={cancelar} aoFechar={() => setCancelar(null)} />
      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

function ItemDeEntrega({
  entrega,
  aoEntregar,
  aoCancelar,
}: {
  entrega: Entrega;
  aoEntregar: () => void;
  aoCancelar: () => void;
}) {
  const aguardando = entrega.situacao === "AGUARDANDO";

  return (
    <Cartao destaque={aguardando}>
      <View style={estilos.topo}>
        <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
          {entrega.premio}
        </Titulo>
        <Selo tom={TOM[entrega.situacao]}>{ROTULO_SITUACAO_ENTREGA[entrega.situacao]}</Selo>
      </View>

      <Apoio numberOfLines={1}>{entrega.campanha}</Apoio>
      <Divisor />

      <Linha rotulo="Cliente">
        <View style={{ alignItems: "flex-end" }}>
          <Texto numberOfLines={1}>{entrega.cliente}</Texto>
          <Apoio>{formatarTelefone(entrega.telefoneCliente)}</Apoio>
        </View>
      </Linha>

      <Linha rotulo="Código">
        <Texto style={{ fontVariant: ["tabular-nums"] }}>{entrega.codigo}</Texto>
      </Linha>

      <Linha rotulo="Solicitado">{desde(entrega.solicitadoEm)}</Linha>
      {entrega.entregueEm ? <Linha rotulo="Entregue">{data(entrega.entregueEm)}</Linha> : null}

      {entrega.instrucoesRetirada ? (
        <>
          <Divisor />
          <Rotulo>Como retirar</Rotulo>
          <Texto>{entrega.instrucoesRetirada}</Texto>
        </>
      ) : null}

      {entrega.observacao ? <Apoio>Observação: {entrega.observacao}</Apoio> : null}

      {aguardando ? (
        <View style={estilos.acoes}>
          <Botao titulo="Entregar" icone="checkmark" onPress={aoEntregar} style={{ flex: 1 }} />
          <Botao titulo="Cancelar" variante="perigo" onPress={aoCancelar} />
        </View>
      ) : null}
    </Cartao>
  );
}

/* -------------------------------------------------------------------------- */
/* Dar baixa                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A baixa da entrega.
 *
 * O código é conferido pelo servidor, e não aqui: comparar no aparelho deixaria a
 * confirmação passar em qualquer aparelho com o app aberto, o que é o oposto do
 * que o código serve para garantir.
 */
function FolhaDeEntrega({ entrega, aoFechar }: { entrega: Entrega | null; aoFechar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [observacao, setObservacao] = useState("");
  const entregar = useEntregar();

  useEffect(() => {
    if (entrega) {
      setCodigo("");
      setObservacao("");
    }
  }, [entrega]);

  return (
    <Folha
      visivel={entrega !== null}
      titulo="Confirmar entrega"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Voltar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
          <Botao
            titulo="Entregar"
            carregando={entregar.isPending}
            onPress={() => {
              if (!entrega) return;
              entregar.mutate(
                {
                  id: entrega.id,
                  codigo: codigo.trim() || undefined,
                  observacao: observacao.trim() || undefined,
                },
                { onSuccess: aoFechar },
              );
            }}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      {entrega ? (
        <>
          <Cartao>
            <Titulo nivel={3}>{entrega.premio}</Titulo>
            <Apoio>{entrega.campanha}</Apoio>
            <Divisor />
            <Linha rotulo="Cliente">{entrega.cliente}</Linha>
            <Linha rotulo="Telefone">{formatarTelefone(entrega.telefoneCliente)}</Linha>
          </Cartao>

          {entrega.instrucoesRetirada ? (
            <View style={{ gap: spacing.xs }}>
              <Rotulo>Como retirar</Rotulo>
              <Texto>{entrega.instrucoesRetirada}</Texto>
            </View>
          ) : null}

          <Campo
            rotulo="Código do prêmio"
            valor={codigo}
            onChange={setCodigo}
            placeholder={entrega.codigo.slice(0, 3) + "-…"}
            autoCapitalize="characters"
            dica="Peça ao cliente. O servidor confere — não é comparado no aparelho."
          />

          <Campo
            rotulo="Observação (opcional)"
            valor={observacao}
            onChange={setObservacao}
            placeholder="Retirado pelo titular, com RG"
            multilinha
          />
        </>
      ) : null}
    </Folha>
  );
}

function CancelamentoDeEntrega({
  entrega,
  aoFechar,
}: {
  entrega: Entrega | null;
  aoFechar: () => void;
}) {
  const [observacao, setObservacao] = useState("");
  const cancelar = useCancelarEntrega();

  useEffect(() => {
    if (entrega) setObservacao("");
  }, [entrega]);

  return (
    <Confirmacao
      visivel={entrega !== null}
      titulo="Cancelar a entrega?"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Manter" variante="secundario" onPress={aoFechar} />
          <Botao
            titulo="Cancelar entrega"
            variante="perigo"
            carregando={cancelar.isPending}
            onPress={() => {
              if (!entrega) return;
              cancelar.mutate(
                { id: entrega.id, observacao: observacao.trim() || undefined },
                { onSuccess: aoFechar },
              );
            }}
          />
        </>
      }
    >
      <Texto>
        O prêmio volta ao estoque e o cliente deixa de ter direito a esta retirada.
      </Texto>
      <Campo
        rotulo="Motivo (opcional)"
        valor={observacao}
        onChange={setObservacao}
        placeholder="Cliente desistiu"
        multilinha
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
  acoes: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
