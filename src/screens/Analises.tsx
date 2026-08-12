import { useState } from "react";
import { View } from "react-native";

import { Barras, Colunas } from "../components/Graficos";
import { Tela } from "../components/Tela";
import {
  Apoio,
  Cartao,
  Conteudo,
  Divisor,
  Linha,
  Secao,
  Seletor,
  SemPermissao,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { pode } from "../constants/permissoes";
import { useAnalises } from "../hooks/use-queries";
import { diaMes, moeda, telefone } from "../lib/format";
import type { Analise } from "../services/contrato";
import { useUsuario } from "../stores/session";
import { spacing } from "../theme";

/**
 * Análises do movimento.
 *
 * As mesmas perguntas do painel web, na ordem em que o dono as faz: o movimento
 * está subindo? quando enche? quem são meus melhores clientes? quem parou de
 * vir? de quanto em quanto tempo eles voltam? quantos estão perto de ganhar?
 *
 * Um seletor de período só, no topo, valendo para tudo. Filtro por gráfico faria
 * cada um olhar uma janela diferente, e aí dois números da mesma tela deixariam
 * de fechar entre si sem ninguém perceber.
 *
 * O que é lista continua lista: "quem sumiu" é nome, telefone e quanto tempo —
 * dado para agir, não para desenhar.
 */

const PERIODOS = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "90", rotulo: "90 dias" },
];

const DIA_DA_SEMANA: Record<string, string> = {
  MONDAY: "seg",
  TUESDAY: "ter",
  WEDNESDAY: "qua",
  THURSDAY: "qui",
  FRIDAY: "sex",
  SATURDAY: "sáb",
  SUNDAY: "dom",
};

export function Analises() {
  const usuario = useUsuario();
  const [dias, setDias] = useState("30");
  const consulta = useAnalises(Number(dias));

  if (!pode(usuario, "analises.ver")) {
    return (
      <Tela titulo="Análises">
        <SemPermissao />
      </Tela>
    );
  }

  return (
    <Tela
      titulo="Análises"
      subtitulo="Quem volta, quem sumiu e quando o movimento aparece"
      aoAtualizar={consulta.refetch}
      atualizando={consulta.isFetching && !consulta.isPending}
    >
      <Seletor rotulo="Período" valor={dias} onChange={setDias} opcoes={PERIODOS} />

      <Conteudo consulta={consulta}>
        {(dados) => (
          <View style={{ gap: spacing.lg }}>
            <Indicadores dados={dados} />
            <Movimento dados={dados} />
            <Clientes dados={dados} />
            <Campanhas dados={dados} />
          </View>
        )}
      </Conteudo>
    </Tela>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Os quatro números do topo.
 *
 * São números, não gráficos: um valor único desenhado como uma barra sozinha não
 * diz nada que o número já não diga.
 */
function Indicadores({ dados }: { dados: Analise }) {
  return (
    <Secao titulo="No período">
      <Cartao>
        <Linha rotulo="Compras registradas">{dados.totalCompras}</Linha>
        <Linha rotulo="Clientes que compraram">{dados.clientesQueCompraram}</Linha>
        <Linha rotulo="Ticket médio">{moeda(dados.ticketMedio)}</Linha>
        <Linha rotulo="Compras por cliente">
          {dados.comprasPorCliente.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </Linha>
      </Cartao>
    </Secao>
  );
}

/* -------------------------------------------------------------------------- */

function Movimento({ dados }: { dados: Analise }) {
  const semMovimento = dados.totalCompras === 0;

  const horas = dados.porHora.map((ponto) => ({
    rotulo: ponto.hora % 6 === 0 ? `${ponto.hora}h` : "",
    valor: ponto.compras,
  }));
  const horaDePico = indiceDoMaior(dados.porHora.map((ponto) => ponto.compras));

  const semana = dados.porDiaDaSemana.map((ponto) => ({
    rotulo: DIA_DA_SEMANA[ponto.dia] ?? ponto.dia,
    valor: ponto.compras,
  }));
  const melhorDia = indiceDoMaior(semana.map((ponto) => ponto.valor));

  return (
    <Secao titulo="Movimento">
      <GraficoCartao
        titulo="Frequência diária"
        explicacao="Compras por dia. Os dias sem venda aparecem zerados de propósito — a segunda-feira morta é informação."
        vazio={semMovimento}
      >
        <Colunas
          dados={dados.porDia.map((ponto, indice) => ({
            // Um rótulo a cada seis dias: com trinta colunas, um rótulo por
            // coluna vira borrão numa tela de celular.
            rotulo:
              indice % Math.max(1, Math.floor(dados.porDia.length / 5)) === 0
                ? diaMes(ponto.dia)
                : "",
            valor: ponto.compras,
          }))}
        />
      </GraficoCartao>

      <GraficoCartao
        titulo="Hora de pico"
        explicacao="Em que hora do dia as compras acontecem. É o que diz quando vale ter mais gente no balcão."
        vazio={semMovimento}
      >
        <Colunas dados={horas} destaque={horaDePico} />
        {horaDePico !== undefined ? (
          <Apoio>
            Pico às {dados.porHora[horaDePico].hora}h, com{" "}
            {dados.porHora[horaDePico].compras}{" "}
            {dados.porHora[horaDePico].compras === 1 ? "compra" : "compras"}.
          </Apoio>
        ) : null}
      </GraficoCartao>

      <GraficoCartao
        titulo="Dia da semana"
        explicacao="O mesmo movimento distribuído na semana. Serve para escolher o dia da promoção — e o dia de fechar mais cedo."
        vazio={semMovimento}
      >
        <Colunas dados={semana} destaque={melhorDia} />
      </GraficoCartao>

      <GraficoCartao
        titulo="Cliente novo ou cliente que já vinha"
        explicacao="A campanha traz gente nova ou segura quem já vinha? Só conta como primeira compra quem também se cadastrou no período — o número nunca é inflado."
        vazio={semMovimento}
      >
        <Barras
          dados={[
            {
              rotulo: "Primeira compra",
              valor: dados.porDia.reduce((total, ponto) => total + ponto.clientesNovos, 0),
            },
            {
              rotulo: "Já vinham",
              valor: dados.porDia.reduce(
                (total, ponto) => total + ponto.clientesRecorrentes,
                0,
              ),
            },
          ]}
        />
      </GraficoCartao>
    </Secao>
  );
}

/* -------------------------------------------------------------------------- */

function Clientes({ dados }: { dados: Analise }) {
  return (
    <Secao titulo="Clientes">
      <GraficoCartao
        titulo="Clientes mais frequentes"
        explicacao="Por número de compras, não por valor gasto: o programa premia quem volta. Quem apareceu uma vez e gastou alto é outro tipo de cliente."
        vazio={dados.maisFrequentes.length === 0}
      >
        <Barras
          dados={dados.maisFrequentes.map((cliente) => ({
            rotulo: cliente.nome,
            valor: cliente.compras,
            apoio: `${moeda(cliente.totalGasto)} no período`,
          }))}
          formatarValor={(valor) => `${valor} ${valor === 1 ? "compra" : "compras"}`}
        />
      </GraficoCartao>

      <GraficoCartao
        titulo="De quanto em quanto tempo o cliente volta"
        explicacao="Média de dias entre compras de cada cliente, contando quem comprou duas vezes ou mais. É este número que diz quando cobrar de volta."
        vazio={dados.intervalos.every((faixa) => faixa.clientes === 0)}
      >
        <Barras
          dados={dados.intervalos.map((faixa) => ({
            rotulo: faixa.rotulo,
            valor: faixa.clientes,
          }))}
        />
      </GraficoCartao>

      <GraficoCartao
        titulo="Há quanto tempo cada cliente não compra"
        explicacao="A base inteira, não só o período: quem sumiu há seis meses não aparece em lançamento nenhum dos últimos dias, e é justamente ele que interessa."
        vazio={dados.recencia.every((faixa) => faixa.clientes === 0)}
      >
        <Barras
          dados={dados.recencia.map((faixa) => ({
            rotulo: faixa.rotulo,
            valor: faixa.clientes,
          }))}
        />
      </GraficoCartao>

      <Sumidos linhas={dados.sumidos} />
    </Secao>
  );
}

/**
 * Quem comprava e parou.
 *
 * Lista, e não gráfico: aqui o dado é para agir. O que se quer é o nome, o
 * telefone e o tamanho do que se está perdendo — e um gráfico esconderia
 * exatamente o telefone.
 */
function Sumidos({ linhas }: { linhas: Analise["sumidos"] }) {
  if (linhas.length === 0) {
    return (
      <Cartao>
        <Titulo nivel={3}>Clientes que pararam de vir</Titulo>
        <Vazio titulo="Ninguém sumiu" descricao="Todo cliente que já comprou voltou nos últimos 30 dias." />
      </Cartao>
    );
  }

  return (
    <Cartao>
      <Titulo nivel={3}>Clientes que pararam de vir</Titulo>
      <Apoio>
        Mais de 30 dias sem comprar, do mais sumido para o menos. Quem está no topo é
        quem mais vale a ligação.
      </Apoio>
      <Divisor />

      {linhas.map((linha) => (
        <View key={linha.clienteId} style={{ gap: 2, paddingVertical: spacing.xs }}>
          <Texto numberOfLines={1}>{linha.nome}</Texto>
          <Apoio>
            {linha.diasSemComprar} dias sem comprar
            {linha.telefone ? ` · ${telefone(linha.telefone)}` : ""}
            {` · já gastou ${moeda(linha.totalGasto)}`}
          </Apoio>
        </View>
      ))}
    </Cartao>
  );
}

/* -------------------------------------------------------------------------- */

function Campanhas({ dados }: { dados: Analise }) {
  /*
   * A barra que importa é a de quem está a um selo do fim: é cliente que já
   * gosta da loja e precisa de um empurrão.
   */
  const aUmSelo = dados.progressoDosCartoes.findIndex(
    (degrau) => degrau.necessarios - degrau.selos === 1,
  );

  return (
    <Secao titulo="Campanhas">
      <GraficoCartao
        titulo="Onde os cartões param"
        explicacao='Quantos cartões estão em cada selo, nas campanhas no ar. Pilha grande no começo significa que a promessa não convence; pilha grande faltando um selo é dinheiro na mesa. Lê-se "selos de necessários".'
        vazio={dados.progressoDosCartoes.length === 0}
        textoVazio="Nenhum cartão fidelidade no ar com selo dado."
      >
        <Colunas
          dados={dados.progressoDosCartoes.map((degrau) => ({
            rotulo: `${degrau.selos}/${degrau.necessarios}`,
            valor: degrau.cartoes,
          }))}
          destaque={aUmSelo >= 0 ? aUmSelo : undefined}
        />
      </GraficoCartao>

      <GraficoCartao
        titulo="Compras por campanha"
        explicacao="Só o que cada campanha produziu no período. Pelos totais históricos, a comparação diria apenas qual delas é mais antiga."
        vazio={dados.porCampanha.length === 0}
        textoVazio="Nenhuma campanha publicada ainda."
      >
        <Barras
          dados={dados.porCampanha.map((campanha) => ({
            rotulo: campanha.nome,
            valor: campanha.compras,
            apoio: `${campanha.clientes} ${
              campanha.clientes === 1 ? "cliente" : "clientes"
            } · ${moeda(campanha.valor)}`,
          }))}
        />
      </GraficoCartao>
    </Secao>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A moldura de um gráfico: título, a frase que explica como ler, e o desenho.
 *
 * A explicação fica junto porque é o que separa um número de uma decisão. "Média
 * de dias entre compras" sozinho não diz a ninguém o que fazer com aquilo.
 */
function GraficoCartao({
  titulo,
  explicacao,
  vazio,
  textoVazio = "Nenhuma compra registrada neste período.",
  children,
}: {
  titulo: string;
  explicacao: string;
  vazio: boolean;
  textoVazio?: string;
  children: React.ReactNode;
}) {
  return (
    <Cartao>
      <Titulo nivel={3}>{titulo}</Titulo>
      <Apoio>{explicacao}</Apoio>
      <Divisor />
      {vazio ? <Vazio titulo="Sem dados no período" descricao={textoVazio} /> : children}
    </Cartao>
  );
}

/** Índice do maior valor, ou `undefined` se está tudo zerado. */
function indiceDoMaior(valores: number[]): number | undefined {
  let indice: number | undefined;
  let maior = 0;

  valores.forEach((valor, posicao) => {
    if (valor > maior) {
      maior = valor;
      indice = posicao;
    }
  });
  return indice;
}
