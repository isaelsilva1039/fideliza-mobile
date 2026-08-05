import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Botao,
  BotaoIcone,
  Busca,
  Cartao,
  Conteudo,
  Filtros,
  Paginacao,
  Secao,
  Selo,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { pode } from "../constants/permissoes";
import { useCampanhas, useParticipantes } from "../hooks/use-queries";
import { data, moeda, plural } from "../lib/format";
import {
  ROTULO_SITUACAO_CAMPANHA,
  ROTULO_TIPO_CAMPANHA,
  type Campanha,
  type SituacaoCampanha,
  type TipoCampanha,
} from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useUsuario } from "../stores/session";
import { spacing, type Tone } from "../theme";

/**
 * A listagem de campanhas.
 *
 * Filtro e busca ficam sempre visíveis, e nenhum vem marcado: uma listagem que
 * abre filtrada esconde dados sem dizer que escondeu, e quem não notou passa a
 * achar que a campanha desapareceu.
 */

const SITUACOES: Array<{ valor: SituacaoCampanha; rotulo: string }> = [
  { valor: "ATIVA", rotulo: "No ar" },
  { valor: "RASCUNHO", rotulo: "Rascunho" },
  { valor: "PAUSADA", rotulo: "Pausada" },
  { valor: "ENCERRADA", rotulo: "Encerrada" },
  { valor: "SORTEADA", rotulo: "Sorteada" },
];

const TIPOS: Array<{ valor: TipoCampanha; rotulo: string }> = [
  { valor: "CARTAO_FIDELIDADE", rotulo: "Cartão" },
  { valor: "SORTEIO", rotulo: "Sorteio" },
];

export const TOM_DA_SITUACAO: Record<SituacaoCampanha, Tone> = {
  ATIVA: "success",
  RASCUNHO: "neutral",
  PAUSADA: "warning",
  ENCERRADA: "neutral",
  SORTEADA: "info",
};

export function Campanhas() {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCampanha[]>([]);
  const [tipo, setTipo] = useState<TipoCampanha[]>([]);
  const [pagina, setPagina] = useState(1);
  const [menuAberto, setMenuAberto] = useState(false);

  const usuario = useUsuario();
  const abrir = useNavegacao((estado) => estado.abrir);
  const podeGerenciar = pode(usuario, "campanhas.gerenciar");

  const consulta = useCampanhas({
    busca: busca.trim() || undefined,
    situacao: situacao.length > 0 ? situacao : undefined,
    tipo: tipo.length > 0 ? tipo : undefined,
    pagina,
    tamanho: 20,
  });

  // Mexer em filtro volta para a primeira página: manter a página 3 ao filtrar
  // mostraria "nada encontrado" com resultados existindo na página 1.
  const trocarFiltro = <T,>(aplicar: (valor: T) => void) => (valor: T) => {
    aplicar(valor);
    setPagina(1);
  };

  return (
    <>
      <Tela
        titulo="Campanhas"
        acoes={
          <View style={{ flexDirection: "row" }}>
            {podeGerenciar ? (
              <BotaoIcone
                icone="add"
                rotulo="Nova campanha"
                onPress={() => abrir({ nome: "campanha-form" })}
              />
            ) : null}
            <BotaoIcone
              icone="person-circle-outline"
              rotulo="Sua conta"
              onPress={() => setMenuAberto(true)}
            />
          </View>
        }
        aoAtualizar={consulta.refetch}
        atualizando={consulta.isFetching && !consulta.isPending}
      >
        <View style={{ gap: spacing.sm }}>
          <Busca
            valor={busca}
            onChange={trocarFiltro(setBusca)}
            placeholder="Buscar por nome ou prêmio"
          />
          <Filtros opcoes={SITUACOES} selecionados={situacao} onChange={trocarFiltro(setSituacao)} />
          <Filtros opcoes={TIPOS} selecionados={tipo} onChange={trocarFiltro(setTipo)} />
        </View>

        <Conteudo
          consulta={consulta}
          vazio={(dados) => dados.content.length === 0}
          aoVazio={
            <Vazio
              icone="megaphone-outline"
              titulo={busca || situacao.length || tipo.length ? "Nada com esse filtro" : "Nenhuma campanha ainda"}
              descricao={
                busca || situacao.length || tipo.length
                  ? "Tente outro termo ou limpe os filtros."
                  : "Crie um cartão fidelidade ou um sorteio para começar."
              }
              acao={
                podeGerenciar && !busca && !situacao.length && !tipo.length ? (
                  <Botao
                    titulo="Nova campanha"
                    icone="add"
                    onPress={() => abrir({ nome: "campanha-form" })}
                  />
                ) : undefined
              }
            />
          }
        >
          {(dados) => (
            <View style={{ gap: spacing.sm }}>
              {dados.content.map((campanha) => (
                <ItemDeCampanha
                  key={campanha.id}
                  campanha={campanha}
                  onPress={() => abrir({ nome: "campanha", id: campanha.id })}
                />
              ))}
              <Paginacao pagina={dados} onChange={setPagina} />
            </View>
          )}
        </Conteudo>
      </Tela>

      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

export function ItemDeCampanha({
  campanha,
  onPress,
}: {
  campanha: Campanha;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={campanha.nome}>
      <Cartao destaque={campanha.podeSortear}>
        <View style={estilos.topo}>
          <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
            {campanha.nome}
          </Titulo>
          <Selo tom={TOM_DA_SITUACAO[campanha.situacao]}>
            {ROTULO_SITUACAO_CAMPANHA[campanha.situacao]}
          </Selo>
        </View>

        <Apoio>{ROTULO_TIPO_CAMPANHA[campanha.tipo]}</Apoio>

        {/* A frase da regra vem pronta do servidor — quem decidiu a regra é quem
            a escreve, então ela nunca discorda do que o sistema faz. */}
        <Texto numberOfLines={2}>{campanha.regraEmUmaFrase}</Texto>

        {campanha.premio ? <Apoio numberOfLines={1}>Prêmio: {campanha.premio.nome}</Apoio> : null}

        <View style={estilos.rodape}>
          <Apoio>{plural(campanha.totalParticipantes, "participante", "participantes")}</Apoio>
          <Apoio>{moeda(campanha.valorMovimentado)}</Apoio>
        </View>

        <Apoio>
          {data(campanha.iniciaEm)} até {data(campanha.terminaEm)}
        </Apoio>

        {campanha.podeSortear ? <Selo tom="brand">Pronta para sortear</Selo> : null}
      </Cartao>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Participantes                                                              */
/* -------------------------------------------------------------------------- */

export function Participantes({ campanhaId, aoVoltar }: { campanhaId: string; aoVoltar: () => void }) {
  const [busca, setBusca] = useState("");
  const [quase, setQuase] = useState(false);
  const [pagina, setPagina] = useState(1);

  const abrir = useNavegacao((estado) => estado.abrir);

  const consulta = useParticipantes(campanhaId, {
    busca: busca.trim() || undefined,
    quaseCompletando: quase || undefined,
    pagina,
    tamanho: 20,
  });

  return (
    <Tela titulo="Participantes" aoVoltar={aoVoltar} aoAtualizar={consulta.refetch}>
      <View style={{ gap: spacing.sm }}>
        <Busca
          valor={busca}
          onChange={(valor) => {
            setBusca(valor);
            setPagina(1);
          }}
          placeholder="Buscar por nome ou documento"
        />
        <Filtros
          opcoes={[{ valor: "quase", rotulo: "Quase completando" }]}
          selecionados={quase ? ["quase"] : []}
          onChange={(sel) => {
            setQuase(sel.length > 0);
            setPagina(1);
          }}
        />
      </View>

      <Conteudo
        consulta={consulta}
        vazio={(dados) => dados.content.length === 0}
        aoVazio={
          <Vazio
            icone="people-outline"
            titulo="Ninguém participa ainda"
            descricao="Registre uma compra vinculada a esta campanha para o primeiro participante aparecer."
          />
        }
      >
        {(dados) => (
          <Secao titulo={`${dados.totalElements} no total`}>
            {dados.content.map((participante) => (
              <Pressable
                key={participante.clienteId}
                onPress={() => abrir({ nome: "cliente", id: participante.clienteId })}
                accessibilityRole="button"
                accessibilityLabel={`Ficha de ${participante.nome}`}
              >
                <Cartao>
                  <View style={estilos.topo}>
                    <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
                      {participante.nome}
                    </Titulo>
                    <Selo tom="brand">{participante.quantidade}</Selo>
                  </View>
                  <Apoio>{participante.documento}</Apoio>
                  <View style={estilos.rodape}>
                    <Apoio>{moeda(participante.totalGasto)}</Apoio>
                    <Apoio>{data(participante.ultimaParticipacao)}</Apoio>
                  </View>
                </Cartao>
              </Pressable>
            ))}
            <Paginacao pagina={dados} onChange={setPagina} />
          </Secao>
        )}
      </Conteudo>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  rodape: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});
