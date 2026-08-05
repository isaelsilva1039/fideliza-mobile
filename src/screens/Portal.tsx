import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Alerta,
  Apoio,
  Botao,
  Campo,
  Cartao,
  Divisor,
  Linha,
  Rotulo,
  Secao,
  Selo,
  Selos,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { data, documento as formatarDocumento, plural, primeiroNome } from "../lib/format";
import { errosPorCampo, mensagemDoErro } from "../lib/api/errors";
import { consultarPortal, pedirCodigo } from "../services";
import type { CartaoDoPortal, PedidoDeCodigo } from "../services/contrato";
import { avisar } from "../stores/avisos";
import { colors, spacing } from "../theme";

/**
 * O portal do cliente.
 *
 * Três passos numa tela só: documento, código, cartão. Passo é estado local e
 * não rota — quem está aqui é o consumidor, uma vez, e empilhar rota faria o
 * botão de voltar do Android devolvê-lo ao formulário de documento depois de já
 * ter se identificado.
 *
 * Não exige sessão. O documento identifica; o código enviado ao telefone é o que
 * autentica.
 */
type Passo =
  | { nome: "documento" }
  | { nome: "codigo"; pedido: PedidoDeCodigo; documento: string }
  | { nome: "cartao"; dados: CartaoDoPortal };

export function Portal({ aoSair }: { aoSair: () => void }) {
  const [passo, setPasso] = useState<Passo>({ nome: "documento" });

  return passo.nome === "cartao" ? (
    <Cartoes dados={passo.dados} aoSair={aoSair} aoTrocar={() => setPasso({ nome: "documento" })} />
  ) : passo.nome === "codigo" ? (
    <ConferirCodigo
      pedido={passo.pedido}
      documento={passo.documento}
      aoVoltar={() => setPasso({ nome: "documento" })}
      aoConfirmar={(dados) => setPasso({ nome: "cartao", dados })}
    />
  ) : (
    <PedirCodigo
      aoSair={aoSair}
      aoEnviar={(pedido, doc) => setPasso({ nome: "codigo", pedido, documento: doc })}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 1 — documento                                                        */
/* -------------------------------------------------------------------------- */

function PedirCodigo({
  aoSair,
  aoEnviar,
}: {
  aoSair: () => void;
  aoEnviar: (pedido: PedidoDeCodigo, documento: string) => void;
}) {
  const [documento, setDocumento] = useState("");
  const [erro, setErro] = useState<string | undefined>();

  const digitos = documento.replace(/\D/g, "");
  const valido = digitos.length === 11 || digitos.length === 14;

  const pedido = useMutation({
    mutationFn: () => pedirCodigo(digitos),
    onSuccess: (resposta) => {
      setErro(undefined);
      aoEnviar(resposta, digitos);
    },
    onError: (falha) => {
      setErro(errosPorCampo(falha).documento ?? mensagemDoErro(falha));
    },
  });

  return (
    <Tela titulo="Meu cartão" aoVoltar={aoSair}>
      <View style={{ gap: spacing.sm }}>
        <Titulo nivel={2}>Qual é o seu CPF?</Titulo>
        <Apoio>
          Enviamos um código para o telefone que você cadastrou na loja. Não
          precisa criar senha.
        </Apoio>
      </View>

      <Campo
        rotulo="CPF ou CNPJ"
        valor={documento}
        onChange={(valor) => {
          // Mascara enquanto digita, mas o que vai para a API são só os dígitos.
          setDocumento(formatarDocumento(valor));
          setErro(undefined);
        }}
        placeholder="000.000.000-00"
        teclado="number-pad"
        maxLength={18}
        erro={erro}
        dica={valido ? undefined : "Digite os 11 dígitos do CPF."}
      />

      <Botao
        titulo="Enviar código"
        largura="cheia"
        onPress={() => pedido.mutate()}
        carregando={pedido.isPending}
        desabilitado={!valido}
      />
    </Tela>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 2 — código                                                           */
/* -------------------------------------------------------------------------- */

function ConferirCodigo({
  pedido,
  documento,
  aoVoltar,
  aoConfirmar,
}: {
  pedido: PedidoDeCodigo;
  documento: string;
  aoVoltar: () => void;
  aoConfirmar: (dados: CartaoDoPortal) => void;
}) {
  const [codigo, setCodigo] = useState(pedido.codigoDemonstracao ?? "");
  const [erro, setErro] = useState<string | undefined>();

  const consulta = useMutation({
    mutationFn: () => consultarPortal(pedido.pedidoId, codigo.trim()),
    onSuccess: aoConfirmar,
    onError: (falha) => setErro(errosPorCampo(falha).codigo ?? mensagemDoErro(falha)),
  });

  const reenviar = useMutation({
    mutationFn: () => pedirCodigo(documento),
    onSuccess: (novo) => {
      if (novo.codigoDemonstracao) setCodigo(novo.codigoDemonstracao);
      avisar.informacao(`Novo código enviado para ${novo.finalDoTelefone}.`);
    },
    onError: (falha) => avisar.erro(mensagemDoErro(falha)),
  });

  return (
    <Tela titulo="Confirme o código" aoVoltar={aoVoltar}>
      <View style={{ gap: spacing.sm }}>
        <Titulo nivel={2}>Digite o código que enviamos</Titulo>
        <Apoio>Mandamos para {pedido.finalDoTelefone}.</Apoio>
      </View>

      {pedido.codigoDemonstracao ? (
        <Alerta
          tom="atencao"
          titulo="Ambiente de demonstração"
          descricao={`O envio de mensagem está simulado, então o código veio na resposta: ${pedido.codigoDemonstracao}. Em produção ele só chega no telefone.`}
        />
      ) : null}

      <Campo
        rotulo="Código"
        valor={codigo}
        onChange={(valor) => {
          setCodigo(valor.replace(/\D/g, ""));
          setErro(undefined);
        }}
        placeholder="000000"
        teclado="number-pad"
        maxLength={6}
        erro={erro}
      />

      <Botao
        titulo="Ver meu cartão"
        largura="cheia"
        onPress={() => consulta.mutate()}
        carregando={consulta.isPending}
        desabilitado={codigo.trim().length < 4}
      />

      <Botao
        titulo="Enviar outro código"
        variante="sutil"
        largura="cheia"
        onPress={() => reenviar.mutate()}
        carregando={reenviar.isPending}
      />
    </Tela>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 3 — o cartão                                                         */
/* -------------------------------------------------------------------------- */

/**
 * O que o cliente vê.
 *
 * Os cartões vêm de **todas** as empresas em que ele participa, não só da que
 * emitiu o código — cada item traz o próprio `empresa`. Por isso a tela agrupa
 * por empresa: sem isso, "Clube do Açaí" e "Abasteça e Ganhe" apareceriam lado a
 * lado sem dizer que são de lojas diferentes.
 */
function Cartoes({
  dados,
  aoSair,
  aoTrocar,
}: {
  dados: CartaoDoPortal;
  aoSair: () => void;
  aoTrocar: () => void;
}) {
  const porEmpresa = useMemo(() => {
    const mapa = new Map<
      string,
      {
        cartoes: CartaoDoPortal["cartoes"];
        sorteios: CartaoDoPortal["sorteios"];
        premios: CartaoDoPortal["premios"];
      }
    >();

    const garantir = (empresa: string) => {
      let grupo = mapa.get(empresa);
      if (!grupo) {
        grupo = { cartoes: [], sorteios: [], premios: [] };
        mapa.set(empresa, grupo);
      }
      return grupo;
    };

    dados.cartoes.forEach((item) => garantir(item.empresa).cartoes.push(item));
    dados.sorteios.forEach((item) => garantir(item.empresa).sorteios.push(item));
    dados.premios.forEach((item) => garantir(item.empresa).premios.push(item));

    return [...mapa.entries()];
  }, [dados]);

  const vazio = porEmpresa.length === 0;

  return (
    <Tela
      titulo={`Olá, ${primeiroNome(dados.primeiroNome)}`}
      subtitulo={`Cartão ${dados.codigoCartao}`}
      aoVoltar={aoSair}
      acoes={<Botao titulo="Trocar" variante="sutil" compacto onPress={aoTrocar} />}
    >
      {/* Prêmio a retirar é a única coisa aqui que pede ação do cliente, então
          vem antes de tudo — inclusive antes dos selos. */}
      {dados.premios.length > 0 ? (
        <Secao titulo={plural(dados.premios.length, "prêmio para retirar", "prêmios para retirar")}>
          {dados.premios.map((premio) => (
            <Cartao key={premio.id} destaque>
              <Titulo nivel={2}>{premio.premio}</Titulo>
              <Apoio>
                {premio.campanha} · {premio.empresa}
              </Apoio>
              <Divisor />
              <Linha rotulo="Código">
                <Texto style={{ fontVariant: ["tabular-nums"] }}>{premio.codigo}</Texto>
              </Linha>
              <Linha rotulo="Desde">{data(premio.desde)}</Linha>
              {premio.instrucoesRetirada ? (
                <>
                  <Divisor />
                  <Rotulo>Como retirar</Rotulo>
                  <Texto>{premio.instrucoesRetirada}</Texto>
                </>
              ) : null}
            </Cartao>
          ))}
        </Secao>
      ) : null}

      {vazio ? (
        <Vazio
          icone="card-outline"
          titulo="Você ainda não participa de nada"
          descricao="Na próxima compra, peça para registrarem no seu CPF — os selos e cupons aparecem aqui."
        />
      ) : null}

      {porEmpresa.map(([empresa, grupo]) => (
        <View key={empresa} style={estilos.grupo}>
          <View style={estilos.tituloEmpresa}>
            <Titulo nivel={2} numberOfLines={1}>
              {empresa}
            </Titulo>
          </View>

          {grupo.cartoes.map((cartao) => {
            const completo = cartao.selosAtuais >= cartao.selosNecessarios;
            return (
              <Cartao key={`${cartao.campanhaId}-cartao`}>
                <View style={estilos.linhaTitulo}>
                  <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
                    {cartao.campanha}
                  </Titulo>
                  {completo ? <Selo tom="success">Completo</Selo> : null}
                </View>
                <Apoio>Prêmio: {cartao.premio}</Apoio>
                <Selos atuais={cartao.selosAtuais} necessarios={cartao.selosNecessarios} />
                {cartao.vezesCompletado > 0 ? (
                  <Apoio>
                    Você já completou {plural(cartao.vezesCompletado, "vez", "vezes")}.
                  </Apoio>
                ) : null}
                <Apoio>Vale até {data(cartao.terminaEm)}</Apoio>
              </Cartao>
            );
          })}

          {grupo.sorteios.map((sorteio) => (
            <Cartao key={`${sorteio.campanhaId}-sorteio`} destaque={sorteio.ganhou}>
              <View style={estilos.linhaTitulo}>
                <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
                  {sorteio.campanha}
                </Titulo>
                {sorteio.ganhou ? (
                  <Selo tom="success">Você ganhou</Selo>
                ) : sorteio.sorteado ? (
                  <Selo tom="neutral">Sorteado</Selo>
                ) : null}
              </View>
              <Apoio>Prêmio: {sorteio.premio}</Apoio>
              <Linha rotulo="Seus cupons">
                <Texto style={{ fontVariant: ["tabular-nums"] }}>{sorteio.cupons}</Texto>
              </Linha>
              {sorteio.sorteiaEm && !sorteio.sorteado ? (
                <Linha rotulo="Sorteio em">{data(sorteio.sorteiaEm)}</Linha>
              ) : null}
              {sorteio.sorteado && !sorteio.ganhou ? (
                <Apoio>Este sorteio já foi realizado. Boa sorte na próxima.</Apoio>
              ) : null}
            </Cartao>
          ))}
        </View>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    gap: spacing.sm,
  },
  tituloEmpresa: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    marginTop: spacing.sm,
  },
  linhaTitulo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
});
