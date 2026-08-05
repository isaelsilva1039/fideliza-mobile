import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { Pressable, StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Alerta,
  Apoio,
  Botao,
  BotaoIcone,
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
import { consultarPortal, listarNotificacoesPortal, marcarNotificacaoPortalComoLida, pedirCodigo } from "../services";
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
  | { nome: "cartao"; pedido: PedidoDeCodigo; dados: CartaoDoPortal };

export function Portal({ aoSair }: { aoSair: () => void }) {
  const [passo, setPasso] = useState<Passo>({ nome: "documento" });

  return passo.nome === "cartao" ? (
    <Cartoes pedido={passo.pedido} dados={passo.dados} aoSair={aoSair} aoTrocar={() => setPasso({ nome: "documento" })} />
  ) : passo.nome === "codigo" ? (
    <ConferirCodigo
      pedido={passo.pedido}
      documento={passo.documento}
      aoVoltar={() => setPasso({ nome: "documento" })}
      aoConfirmar={(dados) => setPasso({ nome: "cartao", pedido: passo.pedido, dados })}
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
  pedido,
  dados,
  aoSair,
  aoTrocar,
}: {
  pedido: PedidoDeCodigo;
  dados: CartaoDoPortal;
  aoSair: () => void;
  aoTrocar: () => void;
}) {
  const [cartao, setCartao] = useState(dados);
  const [lendoNotificacaoId, setLendoNotificacaoId] = useState<string | null>(null);
  const [mostrandoNotificacoes, setMostrandoNotificacoes] = useState(false);
  const [atualizandoNotificacoes, setAtualizandoNotificacoes] = useState(false);

  async function marcarComoLida(id: string) {
    const atual = cartao.notificacoes.find((item) => item.id === id);
    if (!atual || atual.lidaEm) return;

    setLendoNotificacaoId(id);
    try {
      const atualizada = await marcarNotificacaoPortalComoLida(pedido.pedidoId, id);
      const notificacoes = cartao.notificacoes.map((item) =>
        item.id === atualizada.id ? atualizada : item,
      );
      setCartao({
        ...cartao,
        notificacoes,
        notificacoesNaoLidas: notificacoes.filter((item) => !item.lidaEm).length,
      });
    } catch (erro) {
      avisar.erro(mensagemDoErro(erro));
    } finally {
      setLendoNotificacaoId(null);
    }
  }

  async function atualizarNotificacoes() {
    setAtualizandoNotificacoes(true);
    try {
      const notificacoes = await listarNotificacoesPortal(pedido.pedidoId);
      setCartao({
        ...cartao,
        notificacoes,
        notificacoesNaoLidas: notificacoes.filter((item) => !item.lidaEm).length,
      });
    } finally {
      setAtualizandoNotificacoes(false);
    }
  }

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

    cartao.cartoes.forEach((item) => garantir(item.empresa).cartoes.push(item));
    cartao.sorteios.forEach((item) => garantir(item.empresa).sorteios.push(item));
    cartao.premios.forEach((item) => garantir(item.empresa).premios.push(item));

    return [...mapa.entries()];
  }, [cartao]);

  const vazio = porEmpresa.length === 0;

  if (mostrandoNotificacoes) {
    return (
      <Tela
        titulo="Notificações"
        subtitulo={cartao.empresa}
        aoVoltar={() => setMostrandoNotificacoes(false)}
        aoAtualizar={() => void atualizarNotificacoes()}
        atualizando={atualizandoNotificacoes}
      >
        <ListaNotificacoes
          cartao={cartao}
          lendoNotificacaoId={lendoNotificacaoId}
          onMarcarComoLida={marcarComoLida}
        />
      </Tela>
    );
  }

  return (
    <Tela
      titulo={`Olá, ${primeiroNome(cartao.primeiroNome)}`}
      subtitulo={`Cartão ${cartao.codigoCartao}`}
      aoVoltar={aoSair}
      acoes={
        <View style={estilos.acoesTopo}>
          <View>
            <BotaoIcone
              icone={cartao.notificacoesNaoLidas > 0 ? "notifications" : "notifications-outline"}
              rotulo={
                cartao.notificacoesNaoLidas > 0
                  ? `${cartao.notificacoesNaoLidas} notificações novas`
                  : "Notificações"
              }
              onPress={() => setMostrandoNotificacoes(true)}
            />
            {cartao.notificacoesNaoLidas > 0 ? (
              <View style={estilos.badgeSininho}>
                <Texto style={estilos.badgeSininhoTexto}>
                  {cartao.notificacoesNaoLidas > 9 ? "9+" : cartao.notificacoesNaoLidas}
                </Texto>
              </View>
            ) : null}
          </View>
          <Botao titulo="Trocar" variante="sutil" compacto onPress={aoTrocar} />
        </View>
      }
    >
      <View style={estilos.cartaoCliente}>
        <View style={estilos.cartaoClienteBrilho} />
        <View style={estilos.cartaoClienteCirculoMaior} />
        <View style={estilos.cartaoClienteCirculoMenor} />
        <View style={estilos.cartaoClienteTopo}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Rotulo style={estilos.cartaoClienteRotulo}>Cartão</Rotulo>
            <Titulo style={estilos.cartaoClienteTitulo}>Fideliza+</Titulo>
            <Apoio style={estilos.cartaoClienteApoio}>Cartão único do cliente</Apoio>
          </View>
          <QrCodeLocal value={cartao.codigoCartao} size={92} />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Apoio style={estilos.cartaoClienteApoio}>Código do cartão</Apoio>
          <Texto style={estilos.codigoCartao}>{cartao.codigoCartao}</Texto>
        </View>
      </View>

      {cartao.premios.length > 0 ? (
        <Secao titulo={plural(cartao.premios.length, "prêmio para retirar", "prêmios para retirar")}>
          {cartao.premios.map((premio) => (
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
            <Cartao key={`${sorteio.campanhaId}-sorteio`} destaque={sorteio.ganhou || (!sorteio.sorteado && sorteio.situacao === "ENCERRADA")}>
              <View style={estilos.linhaTitulo}>
                <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
                  {sorteio.campanha}
                </Titulo>
                {sorteio.ganhou ? (
                  <Selo tom="success">Você ganhou</Selo>
                ) : sorteio.sorteado ? (
                  <Selo tom="neutral">Sorteado</Selo>
                ) : sorteio.situacao === "ENCERRADA" ? (
                  <Selo tom="warning">Aguardando sorteio</Selo>
                ) : null}
              </View>
              <Apoio>Prêmio: {sorteio.premio}</Apoio>
              <Linha rotulo="Seus cupons">
                <Texto style={{ fontVariant: ["tabular-nums"] }}>
                  {sorteio.limiteTotalCupons
                    ? `${sorteio.cupons}/${sorteio.limiteTotalCupons}`
                    : sorteio.cupons}
                </Texto>
              </Linha>
              {sorteio.sorteiaEm && !sorteio.sorteado ? (
                <Linha rotulo="Sorteio em">{data(sorteio.sorteiaEm)}</Linha>
              ) : null}
              {sorteio.sorteado && !sorteio.ganhou ? (
                <Apoio>Este sorteio já foi realizado. Boa sorte na próxima.</Apoio>
              ) : null}
              {!sorteio.sorteado && sorteio.situacao === "ENCERRADA" ? (
                <Apoio>A campanha encerrou e seus cupons já estão garantidos. Agora é só aguardar a loja realizar o sorteio.</Apoio>
              ) : null}
            </Cartao>
          ))}
        </View>
      ))}
    </Tela>
  );
}

function ListaNotificacoes({
  cartao,
  lendoNotificacaoId,
  onMarcarComoLida,
}: {
  cartao: CartaoDoPortal;
  lendoNotificacaoId: string | null;
  onMarcarComoLida: (id: string) => Promise<void>;
}) {
  if (cartao.notificacoes.length === 0) {
    return (
      <Cartao>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Titulo>Nenhuma notificação no momento</Titulo>
          <Apoio>Quando a loja lançar campanha, selo ou cupom, aparece aqui.</Apoio>
        </View>
      </Cartao>
    );
  }

  return (
    <Secao titulo="Notificações">
      {cartao.notificacoesNaoLidas > 0 ? (
        <Selo tom="brand">
          {cartao.notificacoesNaoLidas} {cartao.notificacoesNaoLidas === 1 ? "nova" : "novas"}
        </Selo>
      ) : null}
      {cartao.notificacoes.map((notificacao) => {
        const lida = Boolean(notificacao.lidaEm);
        return (
          <Pressable
            key={notificacao.id}
            disabled={lida || lendoNotificacaoId === notificacao.id}
            onPress={() => void onMarcarComoLida(notificacao.id)}
            style={[estilos.notificacao, !lida && estilos.notificacaoNova]}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Titulo nivel={3}>{notificacao.titulo}</Titulo>
              <Apoio>{notificacao.mensagem}</Apoio>
              <Rotulo>{lida ? "Lida" : "Toque para marcar como lida"}</Rotulo>
            </View>
          </Pressable>
        );
      })}
    </Secao>
  );
}

function QrCodeLocal({ value, size }: { value: string; size: number }) {
  return (
    <View style={[estilos.qrLocal, { width: size, height: size }]}>
      <QRCode
        value={value || "FIDELIZA"}
        size={size - 14}
        backgroundColor="#FFFFFF"
        color="#000000"
      />
    </View>
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
  cartaoCliente: {
    minHeight: 196,
    padding: spacing.lg,
    gap: spacing.xl,
    borderRadius: 28,
    backgroundColor: colors.primary,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  cartaoClienteBrilho: {
    position: "absolute",
    top: -80,
    right: -72,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cartaoClienteCirculoMaior: {
    position: "absolute",
    top: 58,
    right: 34,
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  cartaoClienteCirculoMenor: {
    position: "absolute",
    top: 82,
    right: 60,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  cartaoClienteTopo: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cartaoClienteRotulo: {
    color: colors.primaryForeground,
    textTransform: "uppercase",
    letterSpacing: 4,
  },
  cartaoClienteTitulo: {
    color: colors.primaryForeground,
    fontSize: 20,
  },
  cartaoClienteApoio: {
    color: colors.primaryForeground,
    opacity: 0.72,
  },
  codigoCartao: {
    color: colors.primaryForeground,
    fontSize: 30,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  qrLocal: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  acoesTopo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  badgeSininho: {
    position: "absolute",
    right: 1,
    top: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  badgeSininhoTexto: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  notificacao: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  notificacaoNova: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
});
