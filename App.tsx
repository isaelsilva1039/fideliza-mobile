import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar, Apoio, Cartao, Divisor, Icone, Linha, Numero, Rotulo, Secao, Selo, Selos, Texto, Titulo } from "./src/components/ui/base";
import { Botao, BotaoIcone } from "./src/components/ui/Botao";
import { ReconhecimentoFacial } from "./src/components/ReconhecimentoFacial";
import { Busca, Campo, CampoMoeda, Filtros, Interruptor, Seletor } from "./src/components/ui/formulario";
import { pode, perfisAtribuiveis } from "./src/constants/permissoes";
import {
  useAlterarSituacaoCampanha,
  useAuditoria,
  useCampanha,
  useCampanhas,
  useCancelarEntrega,
  useClientes,
  useConfiguracao,
  useCriarCampanha,
  useCriarCliente,
  useCriarEmpresa,
  useCriarMembro,
  useEditarCliente,
  useEditarEmpresa,
  useEntregar,
  useEstadoWhatsApp,
  useEntregas,
  useEquipe,
  useInicio,
  useParticipantes,
  useFichaCliente,
  useRegistrarCompra,
  useSalvarConfiguracao,
  useSortear,
  useTodasEmpresas,
} from "./src/hooks/use-queries";
import { mensagemDoErro } from "./src/lib/api/errors";
import { data, dataHora, desde, diaMes, documento, moeda, paraIso, plural, telefone, variacao } from "./src/lib/format";
import { MENU, TITULOS, type NomeDeAba } from "./src/navigation/rotas";
import * as servico from "./src/services";
import {
  ROTULO_PERFIL,
  ROTULO_SITUACAO_CAMPANHA,
  ROTULO_SITUACAO_ENTREGA,
  ROTULO_TRANSICAO,
  ROTULO_TIPO_CAMPANHA,
  type Campanha,
  type CartaoDoPortal,
  type Cliente,
  type Configuracao,
  type Entrega,
  type Empresa,
  type Membro,
  type Participante,
  type Perfil,
  type SituacaoCampanha,
  type SituacaoCliente,
  type SituacaoEntrega,
  type TipoCampanha,
} from "./src/services/contrato";
import { avisar, useAvisos } from "./src/stores/avisos";
import { useSession } from "./src/stores/session";
import { useTema } from "./src/stores/tema";
import { folhaTematica, borderWidth, colors, fontSize, fontWeight, radius, spacing, theme, toneColors, type Tone } from "./src/theme";

const LOGO = require("./assets/logo.png");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
    },
  },
});

type FluxoPublico = "login" | "portal-documento" | "portal-codigo" | "portal-cartao";
type AbaAtual = NomeDeAba | "notificacoes";

export default function App() {
  const esquema = useTema((estado) => estado.esquema);
  const carregado = useTema((estado) => estado.carregado);
  const carregar = useTema((estado) => estado.carregar);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /*
   * Nada desenhado antes de ler a preferência do disco. São milissegundos, e
   * evitam o app abrir claro e piscar para escuro na cara de quem escolheu
   * escuro.
   */
  if (!carregado) return null;

  return (
    <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      {/*
        Os ícones da barra de status invertem com o tema. Sem isto eles ficam
        escuros sobre o fundo preto do tema escuro — some a hora, o sinal e a
        bateria, e ninguém associa isso ao botão que acabou de tocar.
      */}
      <StatusBar style={esquema === "escuro" ? "light" : "dark"} />
      {/*
        `key` no esquema: trocar o tema remonta a árvore inteira. É o que faz as
        folhas de estilo serem lidas de novo — elas são resolvidas no acesso, e
        sem uma renderização nova ninguém as acessa. Remontar custa o estado de
        tela, e trocar de tema é raro o bastante para isso não incomodar.
      */}
      <FidelizaApp key={esquema} />
      <Toasts />
    </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function FidelizaApp() {
  const { session, hydrated, hydrate, setSession, clear, setEmpresaAtiva } = useSession();
  const [fluxoPublico, setFluxoPublico] = useState<FluxoPublico>("login");
  const [aba, setAba] = useState<AbaAtual>("inicio");
  const [campanhaAbertaId, setCampanhaAbertaId] = useState<string | null>(null);
  const [clienteAbertoId, setClienteAbertoId] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!session) return;
    const primeiraAba = abasDoPerfil(session.usuario.perfil)[0]?.rota ?? "inicio";
    setAba((atual) => (atual === "notificacoes" || abasDoPerfil(session.usuario.perfil).some((item) => item.rota === atual) ? atual : primeiraAba));
  }, [session]);

  useEffect(() => {
    setCampanhaAbertaId(null);
    setClienteAbertoId(null);
  }, [session?.empresaAtivaId]);

  if (!hydrated) return <CarregandoTela />;

  if (!session) {
    return fluxoPublico === "login" ? (
      <Login
        onEntrar={async (email, senha) => {
          try {
            const sessao = await servico.entrar(email, senha);
            await setSession(sessao);
            setFluxoPublico("login");
          } catch (erro) {
            avisar.erro(mensagemDoErro(erro));
          }
        }}
        onCliente={() => setFluxoPublico("portal-documento")}
      />
    ) : (
      <PortalCliente fluxo={fluxoPublico} onFluxo={setFluxoPublico} />
    );
  }

  const abas = abasDoPerfil(session.usuario.perfil);
  const empresaAtiva = session.empresas.find((empresa) => empresa.id === session.empresaAtivaId);
  const trocarAba = (proxima: AbaAtual) => {
    setCampanhaAbertaId(null);
    setClienteAbertoId(null);
    setAba(proxima);
  };

  return (
    <Shell
      aba={aba}
      abas={abas}
      usuario={session.usuario.nome}
      perfil={session.usuario.perfil}
      empresa={empresaAtiva?.nomeFantasia ?? "Empresa"}
      empresas={session.empresas}
      empresaAtivaId={session.empresaAtivaId}
      onTrocarEmpresa={(id) => void setEmpresaAtiva(id)}
      onAba={trocarAba}
      onSair={async () => {
        try {
          await servico.sair();
        } finally {
          await clear();
          queryClient.clear();
          setAba("inicio");
        }
      }}
    >
      {aba === "inicio" ? <Inicio perfil={session.usuario.perfil} onAba={trocarAba} /> : null}
      {aba === "campanhas" ? (
        clienteAbertoId ? (
          <ClienteDetalhe id={clienteAbertoId} onVoltar={() => setClienteAbertoId(null)} onAbrirCampanha={(id) => { setClienteAbertoId(null); setCampanhaAbertaId(id); setAba("campanhas"); }} />
        ) : campanhaAbertaId ? (
          <CampanhaDetalhe id={campanhaAbertaId} perfil={session.usuario.perfil} podeGerenciar={pode(session.usuario, "campanhas.gerenciar")} podeSortear={pode(session.usuario, "campanhas.sortear")} onVoltar={() => setCampanhaAbertaId(null)} onAbrirCliente={(id) => setClienteAbertoId(id)} />
        ) : (
          <Campanhas perfil={session.usuario.perfil} podeGerenciar={pode(session.usuario, "campanhas.gerenciar")} podeSortear={pode(session.usuario, "campanhas.sortear")} onAbrirCampanha={setCampanhaAbertaId} />
        )
      ) : null}
      {aba === "clientes" ? (
        clienteAbertoId ? (
          <ClienteDetalhe id={clienteAbertoId} onVoltar={() => setClienteAbertoId(null)} onAbrirCampanha={(id) => { setClienteAbertoId(null); setCampanhaAbertaId(id); setAba("campanhas"); }} />
        ) : (
          <Clientes podeGerenciar={pode(session.usuario, "clientes.gerenciar")} onAbrirCliente={setClienteAbertoId} />
        )
      ) : null}
      {aba === "entregas" ? <Entregas /> : null}
      {aba === "lancamentos" ? <Lancamentos /> : null}
      {aba === "equipe" ? <Equipe perfil={session.usuario.perfil} /> : null}
      {aba === "empresas" ? <Empresas /> : null}
      {aba === "notificacoes" ? <Notificacoes /> : null}
    </Shell>
  );
}

function abasDoPerfil(perfil: Perfil) {
  return MENU.filter((item) => !item.permissao || pode({ perfil }, item.permissao));
}

function Notificacoes() {
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    setAtualizando(true);
    try {
      await queryClient.invalidateQueries();
      avisar.informacao("Notificações atualizadas.");
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => void atualizar()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <Cartao>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={estilos.notificacaoPortalIcone}>
            <Icone nome="notifications-outline" cor={colors.primary} tamanho={24} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Titulo>Nenhuma notificação no momento</Titulo>
            <Apoio>
              Quando houver avisos para sua conta ou empresa, eles aparecerão aqui.
            </Apoio>
          </View>
        </View>
      </Cartao>
    </ScrollView>
  );
}

function Login({ onEntrar, onCliente }: { onEntrar: (email: string, senha: string) => Promise<void>; onCliente: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!email || !senha) {
      avisar.erro("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      await onEntrar(email.trim(), senha);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthLayout subtitulo="Área da loja, atendimento e administração.">
      <Campo rotulo="E-mail" valor={email} onChange={setEmail} teclado="email-address" autoCapitalize="none" placeholder="voce@empresa.com" />
      <Campo rotulo="Senha" valor={senha} onChange={setSenha} segredo placeholder="Sua senha" />
      <Botao titulo="Entrar" icone="log-in-outline" largura="cheia" carregando={carregando} onPress={() => void entrar()} />
      <View style={estilos.divisorComTexto}>
        <View style={estilos.linha} />
        <Apoio>ou</Apoio>
        <View style={estilos.linha} />
      </View>
      <Botao titulo="Sou cliente" icone="card-outline" variante="secundario" largura="cheia" onPress={onCliente} />
    </AuthLayout>
  );
}

function PortalCliente({ fluxo, onFluxo }: { fluxo: FluxoPublico; onFluxo: (fluxo: FluxoPublico) => void }) {
  const [documentoValor, setDocumentoValor] = useState("");
  const [pedidoId, setPedidoId] = useState("");
  const [telefoneFinal, setTelefoneFinal] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cartao, setCartao] = useState<CartaoDoPortal>();
  const [carregando, setCarregando] = useState(false);
  const [cameraFacialAberta, setCameraFacialAberta] = useState(false);

  async function pedirCodigo() {
    if (!documentoValor) return avisar.erro("Informe o documento.");
    setCarregando(true);
    try {
      const pedido = await servico.pedirCodigo(documentoValor);
      setPedidoId(pedido.pedidoId);
      setTelefoneFinal(pedido.finalDoTelefone);
      onFluxo("portal-codigo");
      /*
       * O código vai para o WhatsApp do cliente. Este alerta só aparece quando a
       * plataforma está sem credencial de envio configurada: aí nada foi enviado
       * a lugar nenhum, e sem mostrar na tela não haveria como concluir o acesso
       * em ambiente de desenvolvimento.
       */
      if (pedido.codigoDemonstracao) {
        Alert.alert("Envio de mensagem desativado", `Seu código é ${pedido.codigoDemonstracao}.`);
      }
    } catch (erro) {
      avisar.erro(mensagemDoErro(erro));
    } finally {
      setCarregando(false);
    }
  }

  async function abrirCartao() {
    if (!pedidoId || !codigo) return avisar.erro("Informe o código.");
    setCarregando(true);
    try {
      const dados = await servico.consultarPortal(pedidoId, codigo);
      setCartao(dados);
      onFluxo("portal-cartao");
    } catch (erro) {
      avisar.erro(mensagemDoErro(erro));
    } finally {
      setCarregando(false);
    }
  }

  async function abrirCartaoComRosto(vetor: number[]) {
    try {
      const resultado = await servico.consultarPortalPorRosto(vetor);
      if (resultado.cartao) {
        setPedidoId("");
        setCartao(resultado.cartao);
        setCameraFacialAberta(false);
        onFluxo("portal-cartao");
        return;
      }

      setPedidoId(resultado.pedidoCodigo.pedidoId);
      setTelefoneFinal(resultado.pedidoCodigo.finalDoTelefone);
      setCameraFacialAberta(false);
      onFluxo("portal-codigo");
      if (resultado.pedidoCodigo.codigoDemonstracao) {
        Alert.alert(
          "Envio de mensagem desativado",
          `Seu código é ${resultado.pedidoCodigo.codigoDemonstracao}.`,
        );
      }
    } catch (erro) {
      avisar.erro(mensagemDoErro(erro));
      throw erro;
    }
  }

  if (fluxo === "portal-documento") {
    return (
      <>
        <AuthLayout subtitulo="Consulte cartões, cupons e prêmios." voltar={() => onFluxo("login")}>
          <Botao titulo="Entrar com o rosto" icone="scan-outline" largura="cheia" onPress={() => setCameraFacialAberta(true)} />
          <View style={estilos.divisorComTexto}>
            <View style={estilos.linha} />
            <Apoio>ou use outro método</Apoio>
            <View style={estilos.linha} />
          </View>
          <Campo rotulo="CPF ou CNPJ" valor={documentoValor} onChange={setDocumentoValor} teclado="numeric" placeholder="Somente números" />
          <Botao titulo="Receber código" icone="chatbubble-ellipses-outline" largura="cheia" carregando={carregando} onPress={() => void pedirCodigo()} />
        </AuthLayout>
        <ReconhecimentoFacial
          visivel={cameraFacialAberta}
          modo="reconhecimento"
          titulo="Entrar com o rosto"
          onFechar={() => setCameraFacialAberta(false)}
          onConcluir={abrirCartaoComRosto}
        />
      </>
    );
  }

  if (fluxo === "portal-codigo") {
    return (
      <AuthLayout
        subtitulo={`Enviamos um código de 6 números no WhatsApp ${telefoneFinal}.`}
        voltar={() => onFluxo("portal-documento")}
      >
        <Campo rotulo="Código" valor={codigo} onChange={setCodigo} teclado="numeric" placeholder="000000" />
        <Botao titulo="Abrir meu cartão" icone="card-outline" largura="cheia" carregando={carregando} onPress={() => void abrirCartao()} />
      </AuthLayout>
    );
  }

  return <CartaoPublico pedidoId={pedidoId} cartao={cartao} onCartao={setCartao} onSair={() => onFluxo("login")} />;
}

function CartaoPublico({
  pedidoId,
  cartao,
  onCartao,
  onSair,
}: {
  pedidoId: string;
  cartao?: CartaoDoPortal;
  onCartao: (cartao: CartaoDoPortal) => void;
  onSair: () => void;
}) {
  const [lendoNotificacaoId, setLendoNotificacaoId] = useState<string | null>(null);
  const [mostrandoNotificacoes, setMostrandoNotificacoes] = useState(false);
  const [atualizandoNotificacoes, setAtualizandoNotificacoes] = useState(false);

  async function marcarComoLida(id: string) {
    if (!cartao) return;
    const atual = cartao.notificacoes.find((item) => item.id === id);
    if (!atual || atual.lidaEm) return;

    // O acesso facial sem segundo fator não cria um pedido de código. Nesse
    // caso a leitura vale apenas nesta sessão, sem chamar a rota protegida pelo
    // pedido e provocar um 403.
    if (!pedidoId) {
      const notificacoes = cartao.notificacoes.map((item) =>
        item.id === id ? { ...item, lidaEm: new Date().toISOString() } : item,
      );
      onCartao({
        ...cartao,
        notificacoes,
        notificacoesNaoLidas: notificacoes.filter((item) => !item.lidaEm).length,
      });
      return;
    }

    setLendoNotificacaoId(id);
    try {
      const atualizada = await servico.marcarNotificacaoPortalComoLida(pedidoId, id);
      const notificacoes = cartao.notificacoes.map((item) =>
        item.id === atualizada.id ? atualizada : item,
      );
      onCartao({
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
    if (!cartao || !pedidoId) return;
    setAtualizandoNotificacoes(true);
    try {
      const notificacoes = await servico.listarNotificacoesPortal(pedidoId);
      onCartao({
        ...cartao,
        notificacoes,
        notificacoesNaoLidas: notificacoes.filter((item) => !item.lidaEm).length,
      });
    } finally {
      setAtualizandoNotificacoes(false);
    }
  }

  if (mostrandoNotificacoes) {
    return (
      <SafeAreaView style={estilos.safe}>
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={
            <RefreshControl
              refreshing={atualizandoNotificacoes}
              onRefresh={() => void atualizarNotificacoes()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <TopoSimples
            titulo="Notificações"
            subtitulo={cartao?.empresa ?? "Seu cartão"}
            acao={<Botao titulo="Voltar" variante="sutil" compacto onPress={() => setMostrandoNotificacoes(false)} />}
          />
          <ListaNotificacoesPortal
            cartao={cartao}
            lendoNotificacaoId={lendoNotificacaoId}
            onMarcarComoLida={marcarComoLida}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.safe}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <TopoSimples
          titulo={`Olá${cartao?.primeiroNome ? `, ${cartao.primeiroNome}` : ""}`}
          subtitulo={cartao?.empresa ?? "Seus benefícios"}
          acao={
            <View style={estilos.acoesTopoPortal}>
              <SininhoNotificacoes
                quantidade={cartao?.notificacoesNaoLidas ?? 0}
                onPress={() => setMostrandoNotificacoes(true)}
              />
              <Botao titulo="Sair" variante="sutil" compacto onPress={onSair} />
            </View>
          }
        />
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
            <QrCodeLocal value={cartao?.codigoCartao ?? ""} size={92} />
          </View>
          <View style={estilos.cartaoClienteRodape}>
            <Apoio style={estilos.cartaoClienteApoio}>Código do cartão</Apoio>
            <Text style={estilos.codigoCartao}>{cartao?.codigoCartao ?? ""}</Text>
          </View>
        </View>
        <Secao titulo="Cartões">
          {cartao?.cartoes.length ? cartao.cartoes.map((item) => (
            <Cartao key={`${item.empresa}-${item.campanhaId}`}>
              <Titulo nivel={3}>{item.premio}</Titulo>
              <Apoio>{item.empresa} • {item.campanha}</Apoio>
              <Selos atuais={item.selosAtuais} necessarios={item.selosNecessarios} />
              <Linha rotulo="Termina em">{data(item.terminaEm)}</Linha>
            </Cartao>
          )) : <Vazio texto="Nenhum cartão ativo no momento." />}
        </Secao>
        <Secao titulo="Sorteios">
          {cartao?.sorteios.length ? cartao.sorteios.map((item) => (
            <Cartao key={`${item.empresa}-${item.campanhaId}`} destaque={item.ganhou || (!item.sorteado && item.situacao === "ENCERRADA")}>
              <Linha rotulo={item.premio}>
                <Selo tom={item.ganhou ? "success" : item.sorteado ? "neutral" : item.situacao === "ENCERRADA" ? "warning" : "brand"}>
                  {item.ganhou ? "Ganhou" : item.sorteado ? "Sorteado" : item.situacao === "ENCERRADA" ? "Aguardando sorteio" : "Concorrendo"}
                </Selo>
              </Linha>
              <Texto>{item.limiteTotalCupons ? `${item.cupons}/${item.limiteTotalCupons}` : `${item.cupons} cupons`}</Texto>
              <Apoio>{item.empresa} • {item.campanha}</Apoio>
              {!item.sorteado && item.situacao === "ENCERRADA" ? (
                <Apoio>A campanha encerrou e seus cupons já estão garantidos. Agora é só aguardar a loja realizar o sorteio.</Apoio>
              ) : null}
            </Cartao>
          )) : <Vazio texto="Você ainda não participa de sorteios." />}
        </Secao>
        <Secao titulo="Prêmios">
          {cartao?.premios.length ? cartao.premios.map((item) => (
            <Cartao key={item.id} destaque>
              <Titulo nivel={3}>{item.premio}</Titulo>
              <Texto>{item.codigo}</Texto>
              <Apoio>{item.instrucoesRetirada ?? "Disponível para retirada"} • {desde(item.desde)}</Apoio>
            </Cartao>
          )) : <Vazio texto="Você não tem prêmios para retirar." />}
        </Secao>
      </ScrollView>
    </SafeAreaView>
  );
}

function SininhoNotificacoes({ quantidade, onPress }: { quantidade: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={quantidade > 0 ? `${quantidade} notificações novas` : "Notificações"}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [estilos.sininho, pressed && { opacity: 0.65 }]}
    >
      <Icone nome={quantidade > 0 ? "notifications" : "notifications-outline"} cor={colors.heading} tamanho={22} />
      {quantidade > 0 ? (
        <View style={estilos.sininhoBadge}>
          <Text style={estilos.sininhoBadgeTexto}>{quantidade > 9 ? "9+" : quantidade}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ListaNotificacoesPortal({
  cartao,
  lendoNotificacaoId,
  onMarcarComoLida,
}: {
  cartao?: CartaoDoPortal;
  lendoNotificacaoId: string | null;
  onMarcarComoLida: (id: string) => Promise<void>;
}) {
  if (!cartao?.notificacoes.length) {
    return (
      <Cartao>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={estilos.notificacaoPortalIcone}>
            <Icone nome="notifications-outline" cor={colors.primary} tamanho={24} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Titulo>Nenhuma notificação no momento</Titulo>
            <Apoio>Quando a loja lançar campanha, selo ou cupom, aparece aqui.</Apoio>
          </View>
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
      {cartao.notificacoes.map((item) => {
        const lida = Boolean(item.lidaEm);
        return (
          <Pressable
            key={item.id}
            disabled={lida || lendoNotificacaoId === item.id}
            onPress={() => void onMarcarComoLida(item.id)}
            style={[estilos.notificacaoPortal, !lida && estilos.notificacaoPortalNova]}
          >
            <View style={estilos.notificacaoPortalIcone}>
              <Icone nome={lida ? "checkmark-circle-outline" : "notifications-outline"} cor={lida ? colors.muted : colors.primary} tamanho={22} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Titulo nivel={3}>{item.titulo}</Titulo>
              <Apoio>{item.mensagem}</Apoio>
              {!lida ? <Rotulo>Toque para marcar como lida</Rotulo> : <Rotulo>Lida</Rotulo>}
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

function Shell({
  aba,
  abas,
  usuario,
  perfil,
  empresa,
  empresas,
  empresaAtivaId,
  onTrocarEmpresa,
  onAba,
  onSair,
  children,
}: {
  aba: AbaAtual;
  abas: ReturnType<typeof abasDoPerfil>;
  usuario: string;
  perfil: Perfil;
  empresa: string;
  empresas: Empresa[];
  empresaAtivaId: string;
  onTrocarEmpresa: (id: string) => void;
  onAba: (aba: AbaAtual) => void;
  onSair: () => void;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [compraRapidaAberta, setCompraRapidaAberta] = useState(false);
  /*
   * O Expo 54 liga edge-to-edge no Android: o app desenha por baixo das barras
   * do sistema. A `SafeAreaView` cuida do topo; a navbar e o botão flutuante são
   * posicionados em `absolute` e ficariam atrás dos botões nativos do aparelho,
   * então sobem pela altura que o próprio sistema informa. Fixar um número aqui
   * erraria entre aparelho com gesto e aparelho com três botões.
   */
  const bordas = useSafeAreaInsets();
  const principais = abas.slice(0, 4);
  const resto = abas.slice(4);
  const abaNoResto = resto.some((item) => item.rota === aba);

  return (
    <SafeAreaView style={estilos.safe}>
      <View style={estilos.cabecalho}>
        <View style={estilos.marcaLinha}>
          <LogoMarca />
          <Apoio numberOfLines={1} style={{ flex: 1 }}>{empresa}</Apoio>
        </View>
        <BotaoTema />
        <SininhoNotificacoes quantidade={0} onPress={() => onAba("notificacoes")} />
        <BotaoIcone icone="person-circle-outline" rotulo="Abrir perfil" onPress={() => setPerfilAberto(true)} />
      </View>
      <View style={estilos.tituloTela}>
        <View>
          <Rotulo>{ROTULO_PERFIL[perfil]}</Rotulo>
          <Titulo>{aba === "notificacoes" ? "Notificações" : TITULOS[aba]}</Titulo>
        </View>
      </View>
      <View style={estilos.miolo}>{children}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Registrar compra" style={[estilos.fabCompra, { bottom: bordas.bottom + 92 }]} onPress={() => setCompraRapidaAberta(true)}>
        <Icone nome="cash-outline" tamanho={26} cor={colors.primaryForeground} />
      </Pressable>
      <View style={[estilos.navbar, { bottom: bordas.bottom + spacing.md }]}>
        {principais.map((item) => (
          <ItemNavbar key={item.rota} titulo={item.titulo} icone={item.icone} ativo={aba === item.rota} onPress={() => onAba(item.rota)} />
        ))}
        {resto.length ? (
          <ItemNavbar titulo="Mais" icone="grid-outline" ativo={abaNoResto} onPress={() => setMenuAberto(true)} />
        ) : null}
      </View>
      <Folha visivel={menuAberto} titulo="Menu" onFechar={() => setMenuAberto(false)}>
        {resto.map((item) => (
          <Pressable key={item.rota} style={estilos.itemMenuCompleto} onPress={() => { onAba(item.rota); setMenuAberto(false); }}>
            <Icone nome={item.icone as React.ComponentProps<typeof Ionicons>["name"]} cor={colors.heading} tamanho={21} />
            <View style={{ flex: 1 }}>
              <Texto style={{ fontWeight: fontWeight.semibold }}>{item.titulo}</Texto>
              <Apoio>{item.dica}</Apoio>
            </View>
          </Pressable>
        ))}
      </Folha>
      <Folha visivel={perfilAberto} titulo={usuario} onFechar={() => setPerfilAberto(false)}>
        <Secao titulo="Empresa ativa">
          {empresas.map((item) => (
            <Pressable key={item.id} style={[estilos.itemMenuCompleto, item.id === empresaAtivaId && estilos.itemSelecionado]} onPress={() => { onTrocarEmpresa(item.id); setPerfilAberto(false); }}>
              <Icone nome={item.id === empresaAtivaId ? "checkmark-circle" : "business-outline"} cor={item.id === empresaAtivaId ? colors.primary : colors.muted} />
              <View style={{ flex: 1 }}>
                <Texto style={{ fontWeight: fontWeight.semibold }}>{item.nomeFantasia}</Texto>
                <Apoio>{item.situacao}</Apoio>
              </View>
            </Pressable>
          ))}
        </Secao>
        {pode({ perfil }, "configuracoes.gerenciar") ? <ConfiguracoesCard /> : null}
        <Botao titulo="Sair" icone="log-out-outline" variante="perigo" largura="cheia" onPress={onSair} />
      </Folha>
      <FormularioCompraRapida visivel={compraRapidaAberta} onFechar={() => setCompraRapidaAberta(false)} />
    </SafeAreaView>
  );
}

/**
 * A chave de tema, no topo.
 *
 * Ao lado do sino, e não dentro do menu do perfil: é a única preferência visual
 * do app, e enterrá-la a dois toques faria ninguém achar.
 */
function BotaoTema() {
  const esquema = useTema((estado) => estado.esquema);
  const alternar = useTema((estado) => estado.alternar);

  return (
    <BotaoIcone
      icone={esquema === "escuro" ? "sunny-outline" : "moon-outline"}
      rotulo="Alternar entre tema claro e escuro"
      onPress={alternar}
    />
  );
}

function ItemNavbar({ titulo, icone, ativo, onPress }: { titulo: string; icone: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: ativo }} onPress={onPress} style={[estilos.navItem, ativo && estilos.navItemAtivo]}>
      {ativo ? <View style={estilos.navMarcaAtiva} /> : null}
      <Icone nome={icone as React.ComponentProps<typeof Ionicons>["name"]} cor={ativo ? colors.heading : colors.muted} tamanho={22} />
      <Text numberOfLines={1} style={[estilos.navTexto, ativo && estilos.navTextoAtivo]}>{titulo}</Text>
    </Pressable>
  );
}

function Inicio({ perfil, onAba }: { perfil: Perfil; onAba: (aba: NomeDeAba) => void }) {
  const [dias, setDias] = useState<"1" | "7" | "30">("7");
  const [compraRapidaAberta, setCompraRapidaAberta] = useState(false);
  const query = useInicio(Number(dias));
  const inicio = query.data;

  return (
    <>
      <ScrollView contentContainerStyle={estilos.conteudoComNav}>
        <Seletor rotulo="Período" valor={dias} onChange={setDias} opcoes={[{ valor: "1", rotulo: "Hoje" }, { valor: "7", rotulo: "7 dias" }, { valor: "30", rotulo: "30 dias" }]} />
        <View style={estilos.atalhos}>
          <Atalho icone="cash-outline" titulo="Compra" onPress={() => setCompraRapidaAberta(true)} />
          <Atalho icone="megaphone-outline" titulo="Campanhas" onPress={() => onAba("campanhas")} />
          <Atalho icone="gift-outline" titulo="Entregas" onPress={() => onAba("entregas")} />
          {perfil === "FUNCIONARIO" ? <Atalho icone="people-outline" titulo="Clientes" onPress={() => onAba("clientes")} /> : <Atalho icone="clipboard-outline" titulo="Lançamentos" onPress={() => onAba("lancamentos")} />}
        </View>
        {query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : inicio ? (
          <>
            <View style={estilos.gradeIndicadores}>
              <Indicador titulo="Movimento" valor={moeda(inicio.movimento.valor)} icone="wallet-outline" detalhe={variacao(inicio.movimento.variacao) ?? "no período"} />
              <Indicador titulo="Clientes que compraram" valor={String(inicio.clientesQueCompraram.valor)} icone="people-outline" detalhe={variacao(inicio.clientesQueCompraram.variacao) ?? "ativos"} />
            </View>
            <View style={estilos.gradeIndicadores}>
              <Indicador titulo="Selos e cupons" valor={String(inicio.beneficiosEntregues.valor)} icone="ticket-outline" detalhe={variacao(inicio.beneficiosEntregues.variacao) ?? "entregues"} />
              <Indicador titulo="Campanhas no ar" valor={String(inicio.campanhasNoAr)} icone="megaphone-outline" detalhe={inicio.clientesInativos > 0 ? `${inicio.clientesInativos} inativos` : "publicadas"} />
            </View>

            {inicio.sorteiosProntos.length > 0 ? (
              <Secao titulo={inicio.sorteiosProntos.length === 1 ? "Sorteio pronto" : "Sorteios prontos"}>
                {inicio.sorteiosProntos.map((item) => (
                  <LinhaAcao key={item.id} icone="sparkles-outline" titulo={item.campanha} subtitulo={`${plural(item.participantes, "participante", "participantes")} • ${plural(item.cupons, "cupom", "cupons")} • encerrou ${desde(item.encerradaEm)}`} tom="warning" onPress={() => onAba("campanhas")} />
                ))}
              </Secao>
            ) : null}

            {inicio.quaseCompletando.length > 0 ? (
              <Secao titulo="Quase completando o cartão">
                {inicio.quaseCompletando.slice(0, 6).map((item) => (
                  <Cartao key={`${item.clienteId}-${item.campanhaId}`}>
                    <View style={estilos.linhaEntre}>
                      <View style={{ flex: 1 }}>
                        <Titulo nivel={3} numberOfLines={1}>{item.cliente}</Titulo>
                        <Apoio numberOfLines={1}>{item.campanha} • {telefone(item.telefone)}</Apoio>
                      </View>
                      <Selo tom="info">{item.faltam === 1 ? "falta 1" : `faltam ${item.faltam}`}</Selo>
                    </View>
                    <Selos atuais={item.selosAtuais} necessarios={item.selosNecessarios} />
                  </Cartao>
                ))}
              </Secao>
            ) : null}

            <Secao titulo="Prêmios para entregar">
              {inicio.entregasPendentes.length ? inicio.entregasPendentes.slice(0, 4).map((item) => (
                <LinhaAcao key={item.id} icone="gift-outline" titulo={item.cliente} subtitulo={`${item.premio} • ${item.codigo} • ${desde(item.desde)}`} tom="brand" onPress={() => onAba("entregas")} />
              )) : <Vazio texto="Nada pendente. Todos os prêmios já foram entregues." />}
            </Secao>

            {inicio.premiosEntregues.length ? (
              <Secao titulo="Prêmios entregues">
                {inicio.premiosEntregues.slice(0, 4).map((item) => (
                  <LinhaAcao
                    key={item.id}
                    icone="checkmark-done-outline"
                    titulo={item.premio}
                    subtitulo={`${item.cliente} • recebeu: ${item.recebedor} • ${desde(item.entregueEm)}`}
                    tom="success"
                    onPress={() => onAba("entregas")}
                  />
                ))}
              </Secao>
            ) : null}

            <Secao titulo="Movimento por dia">
              <Cartao>
                <GraficoMovimento pontos={inicio.movimentoPorDia} />
              </Cartao>
            </Secao>

            <Secao titulo="Suas campanhas" acao={<Botao titulo="Ver todas" variante="sutil" compacto onPress={() => onAba("campanhas")} />}>
              {inicio.campanhas.length ? inicio.campanhas.slice(0, 5).map((item) => (
                <Pressable key={item.id} onPress={() => onAba("campanhas")} accessibilityRole="button" accessibilityLabel={item.premio}>
                  <Cartao>
                    <View style={estilos.linhaEntre}>
                      <View style={{ flex: 1 }}>
                        <Titulo nivel={3} numberOfLines={1}>{item.premio}</Titulo>
                        <Apoio>{item.nome} • {ROTULO_TIPO_CAMPANHA[item.tipo]}</Apoio>
                      </View>
                      <Selo tom={tomCampanha(item.situacao)}>{ROTULO_SITUACAO_CAMPANHA[item.situacao]}</Selo>
                    </View>
                    <Apoio>{plural(item.participantes, "cliente", "clientes")}</Apoio>
                  </Cartao>
                </Pressable>
              )) : <Vazio texto="Nenhuma campanha publicada." />}
            </Secao>

            {inicio.proximosSorteios.length > 0 ? (
              <Secao titulo="Sorteios marcados">
                {inicio.proximosSorteios.map((item) => (
                  <LinhaAcao key={item.id} icone="calendar-outline" titulo={item.campanha} subtitulo={`${item.premio} • ${data(item.sorteiaEm)} • ${plural(item.participantes, "participante", "participantes")}`} tom="brand" onPress={() => onAba("campanhas")} />
                ))}
              </Secao>
            ) : null}

            <Secao titulo="Últimas compras">
              {inicio.ultimasCompras.length ? inicio.ultimasCompras.map((item) => (
                <Cartao key={item.id}>
                  <View style={estilos.linhaEntre}>
                    <View style={{ flex: 1 }}>
                      <Texto numberOfLines={1}>{item.cliente}</Texto>
                      <Apoio numberOfLines={1}>{item.beneficio} • {desde(item.quando)}</Apoio>
                    </View>
                    <Texto style={{ fontWeight: fontWeight.semibold }}>{moeda(item.valor)}</Texto>
                  </View>
                </Cartao>
              )) : <Vazio texto="Nenhuma compra registrada ainda." />}
            </Secao>
          </>
        ) : null}
      </ScrollView>
      <FormularioCompraRapida visivel={compraRapidaAberta} onFechar={() => setCompraRapidaAberta(false)} />
    </>
  );
}

function Campanhas({ perfil, podeGerenciar, podeSortear, onAbrirCampanha }: { perfil: Perfil; podeGerenciar: boolean; podeSortear: boolean; onAbrirCampanha: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const [situacoes, setSituacoes] = useState<SituacaoCampanha[]>([]);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const query = useCampanhas({ busca, situacao: situacoes, tamanho: 50 });
  const alterar = useAlterarSituacaoCampanha();
  const sortear = useSortear((sorteio) => Alert.alert("Sorteio realizado", sorteio.ganhadores.map((g) => `${g.posicao}. ${g.nome}`).join("\n") || "Sem ganhadores."));
  const totalFiltros = (busca.trim() ? 1 : 0) + situacoes.length;

  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Campanhas" acao={podeGerenciar ? <Botao titulo="Nova" icone="add" compacto onPress={() => setFormAberto(true)} /> : undefined} />
      <View style={estilos.filtroResumo}>
        <Botao titulo={totalFiltros ? `Filtros (${totalFiltros})` : "Filtros"} icone={filtrosAbertos ? "chevron-up" : "options-outline"} variante={totalFiltros ? "primario" : "secundario"} compacto onPress={() => setFiltrosAbertos((aberto) => !aberto)} />
        {totalFiltros ? <Botao titulo="Limpar" variante="sutil" compacto onPress={() => { setBusca(""); setSituacoes([]); }} /> : null}
      </View>
      {filtrosAbertos ? (
        <Cartao style={estilos.painelFiltros}>
          <Busca valor={busca} onChange={setBusca} placeholder="Buscar campanha" />
          <Filtros<SituacaoCampanha> selecionados={situacoes} onChange={setSituacoes} opcoes={["ATIVA", "RASCUNHO", "PAUSADA", "ENCERRADA", "SORTEADA"].map((valor) => ({ valor: valor as SituacaoCampanha, rotulo: ROTULO_SITUACAO_CAMPANHA[valor as SituacaoCampanha] }))} />
        </Cartao>
      ) : totalFiltros ? (
        <Apoio numberOfLines={1}>{resumoFiltrosCampanha(busca, situacoes)}</Apoio>
      ) : null}
      <FlatList
        data={query.data?.content ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.listaComNav}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhuma campanha encontrada." />}
        renderItem={({ item }) => (
          <CampanhaCard
            campanha={item}
            perfil={perfil}
            podeGerenciar={podeGerenciar}
            podeSortear={podeSortear}
            alterando={alterar.isPending}
            sorteando={sortear.isPending}
            onAbrir={() => onAbrirCampanha(item.id)}
            onAlterar={(situacao) => confirmarAlteracaoCampanha(item, situacao, () => alterar.mutate({ id: item.id, situacao }))}
            onSortear={() => confirmarSorteioCampanha(item, () => sortear.mutate(item.id))}
          />
        )}
      />
      <FormularioCampanha visivel={formAberto} onFechar={() => setFormAberto(false)} />
    </View>
  );
}

function CampanhaCard({
  campanha,
  perfil,
  podeGerenciar,
  podeSortear,
  alterando,
  sorteando,
  onAbrir,
  onAlterar,
  onSortear,
}: {
  campanha: Campanha;
  perfil: Perfil;
  podeGerenciar: boolean;
  podeSortear: boolean;
  alterando: boolean;
  sorteando: boolean;
  onAbrir: () => void;
  onAlterar: (situacao: SituacaoCampanha) => void;
  onSortear: () => void;
}) {
  const progresso = progressoCampanha(campanha);
  const icone = campanha.tipo === "CARTAO_FIDELIDADE" ? "ticket-outline" : "sparkles-outline";
  const limiteCupons = campanha.tipo === "SORTEIO" ? campanha.regra.limiteTotalCupons : undefined;
  const progressoCupons =
    limiteCupons && limiteCupons > 0
      ? Math.min(100, Math.round(((campanha.totalBeneficios ?? 0) / limiteCupons) * 100))
      : 0;
  const limiteCuponsAtingido = Boolean(limiteCupons && (campanha.totalBeneficios ?? 0) >= limiteCupons);
  const destaque = campanha.podeSortear || campanha.situacao === "ATIVA";
  const transicoesPermitidas = campanha.proximasSituacoes
    .slice(0, 2)
    .filter((situacao) => usuarioPodeAlterarCampanha(perfil, podeGerenciar, campanha, situacao));
  const podeExecutarSorteio = usuarioPodeSortearCampanha(perfil, podeSortear, campanha);

  return (
    <Pressable onPress={onAbrir} accessibilityRole="button" accessibilityLabel={`Abrir ${campanha.premio?.nome ?? campanha.nome}`}>
      <Cartao destaque={destaque} style={estilos.campanhaCard}>
        <View style={estilos.campanhaTopo}>
          <View style={estilos.campanhaIcone}>
            <Icone nome={icone} tamanho={24} cor={colors.primaryForeground} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={estilos.linhaEntre}>
              <Selo tom={tomCampanha(campanha.situacao)}>{ROTULO_SITUACAO_CAMPANHA[campanha.situacao]}</Selo>
              <Selo tom="brand">{ROTULO_TIPO_CAMPANHA[campanha.tipo]}</Selo>
            </View>
            <Titulo nivel={2} numberOfLines={2}>{campanha.premio?.nome ?? "Prêmio a definir"}</Titulo>
            <Apoio numberOfLines={1}>{campanha.nome}</Apoio>
            <Apoio numberOfLines={2}>{campanha.regraEmUmaFrase}</Apoio>
            {limiteCupons ? (
              <View style={estilos.limiteCuponsCard}>
                <Icone nome="ticket-outline" tamanho={16} cor={colors.heading} />
                <Texto style={{ fontWeight: fontWeight.semibold }}>
                  {campanha.totalBeneficios ?? 0}/{limiteCupons} cupons
                </Texto>
              </View>
            ) : null}
          </View>
        </View>

        <View style={estilos.campanhaFaixa}>
          <View style={{ flex: 1 }}>
            <Rotulo>Campanha</Rotulo>
            <Texto numberOfLines={1} style={{ fontWeight: fontWeight.semibold }}>{campanha.nome}</Texto>
          </View>
          {campanha.podeSortear ? <Selo tom="warning">Pronta para sortear</Selo> : null}
        </View>

        {limiteCupons ? (
          <>
            <View style={estilos.campanhaProgressoFundo}>
              <View
                style={[
                  estilos.campanhaProgressoBarra,
                  {
                    width: `${progressoCupons}%`,
                    backgroundColor: limiteCuponsAtingido ? colors.warning : colors.primary,
                  },
                ]}
              />
            </View>
            <Apoio>
              {progressoCupons}% dos cupons emitidos •{" "}
              {limiteCuponsAtingido
                ? "limite atingido"
                : `${Math.max(0, limiteCupons - (campanha.totalBeneficios ?? 0))} restantes`}
            </Apoio>
          </>
        ) : (
          <>
            <View style={estilos.campanhaProgressoFundo}>
              <View style={[estilos.campanhaProgressoBarra, { width: `${progresso}%` }]} />
            </View>
            <Apoio>{textoPeriodoCampanha(campanha)} • {progresso}% do período</Apoio>
          </>
        )}

        <View style={estilos.gradeIndicadores}>
          <MiniDado rotulo="Participantes" valor={String(campanha.totalParticipantes)} />
          <MiniDado rotulo="Lançamentos" valor={String(campanha.totalLancamentos)} />
          <MiniDado rotulo="Movimento" valor={moeda(campanha.valorMovimentado)} />
        </View>

        <View style={estilos.acoesLinha}>
          {transicoesPermitidas.map((situacao) => (
            <Botao key={situacao} titulo={rotuloAcaoCampanha(campanha, situacao)} variante={situacao === "ENCERRADA" ? "secundario" : "primario"} compacto carregando={alterando} onPress={() => onAlterar(situacao)} />
          ))}
          {podeExecutarSorteio ? <Botao titulo="Sortear" icone="trophy-outline" compacto carregando={sorteando} onPress={onSortear} /> : null}
          <Botao titulo="Detalhes" icone="chevron-forward" variante="sutil" compacto onPress={onAbrir} />
        </View>
      </Cartao>
    </Pressable>
  );
}

function confirmarAlteracaoCampanha(campanha: Campanha, situacao: SituacaoCampanha, aoConfirmar: () => void) {
  const rotulo = rotuloAcaoCampanha(campanha, situacao);
  const acao = rotulo.toLowerCase();
  const mensagem = situacao === "ATIVA"
    ? "A campanha ficará disponível para lançamentos de compra."
    : situacao === "ENCERRADA"
      ? "A campanha será encerrada e deixará de receber novos lançamentos."
      : situacao === "PAUSADA"
        ? "A campanha ficará pausada e não receberá novos lançamentos enquanto estiver assim."
        : "Essa alteração muda a disponibilidade da campanha.";

  Alert.alert(
    `${rotulo} campanha?`,
    `Você confirma ${acao} "${campanha.nome}"?\n\n${mensagem}`,
    [
      { text: "Cancelar", style: "cancel" },
      { text: rotulo, style: situacao === "ENCERRADA" ? "destructive" : "default", onPress: aoConfirmar },
    ],
  );
}

function rotuloAcaoCampanha(campanha: Campanha, situacao: SituacaoCampanha) {
  if (situacao === "ATIVA" && campanha.situacao === "RASCUNHO") return "Disponibilizar";
  return ROTULO_TRANSICAO[situacao];
}

function usuarioPodeAlterarCampanha(perfil: Perfil, permissaoGlobal: boolean, campanha: Campanha, situacao: SituacaoCampanha) {
  if (permissaoGlobal) return true;
  if (perfil !== "FUNCIONARIO") return false;
  if (situacao === "ATIVA") return campanha.funcionarioPodePublicar;
  if (situacao === "PAUSADA") return campanha.funcionarioPodePausar;
  if (situacao === "ENCERRADA") return campanha.funcionarioPodeEncerrar;
  return false;
}

function usuarioPodeSortearCampanha(perfil: Perfil, permissaoGlobal: boolean, campanha: Campanha) {
  if (!campanha.podeSortear) return false;
  if (permissaoGlobal) return true;
  return perfil === "FUNCIONARIO" && campanha.funcionarioPodeSortear;
}

function confirmarSorteioCampanha(campanha: Campanha, aoConfirmar: () => void) {
  Alert.alert(
    "Realizar sorteio?",
    `Você confirma o sorteio da campanha "${campanha.nome}"?\n\nDepois de sorteada, o resultado fica registrado para auditoria.`,
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Sortear", onPress: aoConfirmar },
    ],
  );
}

function progressoCampanha(campanha: Campanha) {
  const inicio = new Date(campanha.iniciaEm).getTime();
  const fim = new Date(campanha.terminaEm).getTime();
  const agora = Date.now();
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return 0;
  return Math.max(0, Math.min(100, Math.round(((agora - inicio) / (fim - inicio)) * 100)));
}

function textoPeriodoCampanha(campanha: Campanha) {
  return `${data(campanha.iniciaEm)} até ${data(campanha.terminaEm)}`;
}

function resumoFiltrosCampanha(busca: string, situacoes: SituacaoCampanha[]) {
  const partes = [
    busca.trim() ? `Busca: ${busca.trim()}` : null,
    situacoes.length ? `Situação: ${situacoes.map((s) => ROTULO_SITUACAO_CAMPANHA[s]).join(", ")}` : null,
  ].filter(Boolean);
  return partes.join(" • ");
}

function Clientes({ podeGerenciar, onAbrirCliente }: { podeGerenciar: boolean; onAbrirCliente: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [compraCliente, setCompraCliente] = useState<Cliente | null>(null);
  const query = useClientes({ busca, tamanho: 80 });

  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Clientes" acao={podeGerenciar ? <Botao titulo="Novo" icone="person-add-outline" compacto onPress={() => setFormAberto(true)} /> : undefined} />
      <Busca valor={busca} onChange={setBusca} placeholder="Nome, documento ou cartão" />
      <FlatList
        data={query.data?.content ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.listaComNav}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhum cliente encontrado." />}
        renderItem={({ item }) => (
          <Cartao>
            <Pressable style={estilos.linhaEntre} onPress={() => onAbrirCliente(item.id)} accessibilityRole="button" accessibilityLabel={`Abrir ficha de ${item.nome}`}>
              <View style={estilos.linhaComIcone}>
                <Avatar nome={item.nome} />
                <View style={{ flex: 1 }}>
                  <Titulo nivel={3}>{item.nome}</Titulo>
                  <Apoio>{documento(item.documento)} • {telefone(item.telefone)}</Apoio>
                </View>
              </View>
              <Selo tom={item.situacao === "ATIVO" ? "success" : "neutral"}>{item.situacao}</Selo>
            </Pressable>
            <Linha rotulo="Cartão">{item.codigoCartao}</Linha>
            <Linha rotulo="Total gasto">{moeda(item.totalGasto)}</Linha>
            <View style={estilos.acoesLinha}>
              <Botao titulo="Ver ficha" icone="person-outline" variante="secundario" compacto onPress={() => onAbrirCliente(item.id)} />
              <Botao titulo="Registrar compra" icone="cash-outline" compacto onPress={() => setCompraCliente(item)} />
            </View>
          </Cartao>
        )}
      />
      <FormularioCliente visivel={formAberto} onFechar={() => setFormAberto(false)} />
      <FormularioCompra cliente={compraCliente} onFechar={() => setCompraCliente(null)} />
    </View>
  );
}

function CampanhaDetalhe({
  id,
  perfil,
  podeGerenciar,
  podeSortear,
  onVoltar,
  onAbrirCliente,
}: {
  id: string;
  perfil: Perfil;
  podeGerenciar: boolean;
  podeSortear: boolean;
  onVoltar: () => void;
  onAbrirCliente: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [quaseCompletando, setQuaseCompletando] = useState(false);
  const detalhe = useCampanha(id);
  const participantes = useParticipantes(id, { busca, quaseCompletando: quaseCompletando || undefined, tamanho: 80 });
  const alterar = useAlterarSituacaoCampanha();
  const sortear = useSortear((sorteio) => Alert.alert("Sorteio realizado", sorteio.ganhadores.map((g) => `${g.posicao}. ${g.nome}`).join("\n") || "Sem ganhadores."));

  if (detalhe.isLoading) return <CarregandoBloco />;
  if (detalhe.isError || !detalhe.data) return <ErroBloco />;

  const campanha = detalhe.data.campanha;
  const isCartao = campanha.tipo === "CARTAO_FIDELIDADE";
  const limiteCupons = !isCartao ? campanha.regra.limiteTotalCupons : undefined;
  const progressoCupons =
    limiteCupons && limiteCupons > 0
      ? Math.min(100, Math.round((detalhe.data.totalBeneficios / limiteCupons) * 100))
      : 0;
  const limiteCuponsAtingido = Boolean(limiteCupons && detalhe.data.totalBeneficios >= limiteCupons);
  const transicoesPermitidas = campanha.proximasSituacoes
    .slice(0, 2)
    .filter((situacao) => usuarioPodeAlterarCampanha(perfil, podeGerenciar, campanha, situacao));
  const podeExecutarSorteio = usuarioPodeSortearCampanha(perfil, podeSortear, campanha);

  return (
    <ScrollView contentContainerStyle={estilos.conteudoComNav}>
      <TopoDetalhe titulo={campanha.nome} subtitulo={campanha.descricao} onVoltar={onVoltar} />
      <View style={estilos.acoesLinha}>
        {transicoesPermitidas.map((situacao) => (
          <Botao key={situacao} titulo={rotuloAcaoCampanha(campanha, situacao)} variante={situacao === "ENCERRADA" ? "secundario" : "primario"} compacto carregando={alterar.isPending} onPress={() => confirmarAlteracaoCampanha(campanha, situacao, () => alterar.mutate({ id: campanha.id, situacao }))} />
        ))}
        {podeExecutarSorteio ? <Botao titulo="Sortear agora" icone="sparkles-outline" compacto carregando={sortear.isPending} onPress={() => confirmarSorteioCampanha(campanha, () => sortear.mutate(campanha.id))} /> : null}
      </View>

      <View style={estilos.linhaEntre}>
        <Selo tom={tomCampanha(campanha.situacao)}>{ROTULO_SITUACAO_CAMPANHA[campanha.situacao]}</Selo>
        <Selo tom="brand">{ROTULO_TIPO_CAMPANHA[campanha.tipo]}</Selo>
        {limiteCuponsAtingido ? <Selo tom="warning">Limite atingido</Selo> : null}
      </View>

      {limiteCupons ? (
        <Cartao destaque={limiteCuponsAtingido}>
          <View style={estilos.linhaEntre}>
            <View style={{ flex: 1 }}>
              <Rotulo>{limiteCuponsAtingido ? "Campanha fechada por limite" : "Limite de cupons"}</Rotulo>
              <Titulo nivel={3}>
                {detalhe.data.totalBeneficios}/{limiteCupons} cupons
              </Titulo>
            </View>
            <Selo tom={limiteCuponsAtingido ? "warning" : "brand"}>{progressoCupons}%</Selo>
          </View>
          <View style={estilos.campanhaProgressoFundo}>
            <View
              style={[
                estilos.campanhaProgressoBarra,
                {
                  width: `${progressoCupons}%`,
                  backgroundColor: limiteCuponsAtingido ? colors.warning : colors.primary,
                },
              ]}
            />
          </View>
          <Apoio>
            {limiteCuponsAtingido
              ? "O limite foi atingido. Essa campanha não aceita novos lançamentos de cupom."
              : `Restam ${Math.max(0, limiteCupons - detalhe.data.totalBeneficios)} cupons para atingir o limite.`}
          </Apoio>
        </Cartao>
      ) : null}

      {detalhe.data.sorteio ? (
        <Cartao destaque>
          <Titulo nivel={3}>{detalhe.data.sorteio.ganhadores.length === 1 ? "Ganhador" : "Ganhadores"}</Titulo>
          {detalhe.data.sorteio.ganhadores.map((ganhador) => (
            <Pressable key={ganhador.clienteId} onPress={() => onAbrirCliente(ganhador.clienteId)} accessibilityRole="button" accessibilityLabel={`Abrir ${ganhador.nome}`}>
              <Linha rotulo={`${ganhador.posicao}. ${ganhador.nome}`}>
                <Texto>{ganhador.numeroCupom}</Texto>
              </Linha>
            </Pressable>
          ))}
          <Apoio>Sorteado em {dataHora(detalhe.data.sorteio.realizadoEm)} • hash {detalhe.data.sorteio.hashLista.slice(0, 12)}</Apoio>
        </Cartao>
      ) : null}

      <View style={estilos.gradeIndicadores}>
        <Indicador titulo="Clientes participando" valor={String(campanha.totalParticipantes)} icone="people-outline" />
        <Indicador titulo={isCartao ? "Selos entregues" : "Cupons gerados"} valor={String(detalhe.data.totalBeneficios)} icone={isCartao ? "ticket-outline" : "albums-outline"} />
      </View>
      <View style={estilos.gradeIndicadores}>
        <Indicador titulo="Movimento" valor={moeda(campanha.valorMovimentado)} icone="wallet-outline" />
        <Indicador titulo="Prêmio" valor={campanha.premio?.nome ?? "A definir"} icone="gift-outline" />
      </View>

      <Secao titulo="Como funciona">
        <Cartao>
          <Texto>{campanha.regraEmUmaFrase}</Texto>
          <Linha rotulo="Período">{`${data(campanha.iniciaEm)} a ${data(campanha.terminaEm)}`}</Linha>
          {campanha.sorteiaEm ? <Linha rotulo="Sorteio">{data(campanha.sorteiaEm)}</Linha> : null}
          {campanha.premio ? (
            <>
              <Divisor />
              <Titulo nivel={3}>{campanha.premio.nome}</Titulo>
              <Apoio>{campanha.premio.descricao}</Apoio>
              <Linha rotulo="Disponíveis">{`${campanha.premio.quantidadeDisponivel} de ${campanha.premio.quantidadeTotal}`}</Linha>
              {campanha.premio.instrucoesRetirada ? <Apoio>Retirada: {campanha.premio.instrucoesRetirada}</Apoio> : null}
            </>
          ) : null}
        </Cartao>
      </Secao>

      <Secao titulo="Quem está participando" acao={isCartao ? <Botao titulo={quaseCompletando ? "Todos" : "Quase lá"} variante={quaseCompletando ? "primario" : "secundario"} compacto onPress={() => setQuaseCompletando((valor) => !valor)} /> : undefined}>
        <Busca valor={busca} onChange={setBusca} placeholder="Buscar participante" />
        {participantes.isLoading ? <CarregandoBloco /> : participantes.isError ? <ErroBloco /> : participantes.data?.content.length ? participantes.data.content.map((item) => (
          <ParticipanteCard key={item.clienteId} participante={item} tipo={campanha.tipo} onPress={() => onAbrirCliente(item.clienteId)} />
        )) : <Vazio texto="Nenhum participante encontrado." />}
      </Secao>
    </ScrollView>
  );
}

function ParticipanteCard({ participante, tipo, onPress }: { participante: Participante; tipo: TipoCampanha; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${participante.nome}`}>
      <Cartao>
        <View style={estilos.linhaEntre}>
          <View style={{ flex: 1 }}>
            <Titulo nivel={3} numberOfLines={1}>{participante.nome}</Titulo>
            <Apoio>{documento(participante.documento)} • {telefone(participante.telefone)}</Apoio>
          </View>
          <Selo tom="brand">{participante.quantidade} {tipo === "CARTAO_FIDELIDADE" ? "selos" : "cupons"}</Selo>
        </View>
        <Linha rotulo="Total gasto">{moeda(participante.totalGasto)}</Linha>
        <Apoio>Última participação: {desde(participante.ultimaParticipacao)}</Apoio>
      </Cartao>
    </Pressable>
  );
}

function ClienteDetalhe({ id, onVoltar, onAbrirCampanha }: { id: string; onVoltar: () => void; onAbrirCampanha: (id: string) => void }) {
  const ficha = useFichaCliente(id);
  const [compraAberta, setCompraAberta] = useState(false);
  const [edicaoAberta, setEdicaoAberta] = useState(false);

  if (ficha.isLoading) return <CarregandoBloco />;
  if (ficha.isError || !ficha.data) return <ErroBloco />;

  const cliente = ficha.data.cliente;
  const premiosPendentes = ficha.data.premios.filter((item) => item.situacao === "AGUARDANDO");
  const premiosRecebidos = ficha.data.premios.filter((item) => item.situacao !== "AGUARDANDO");

  return (
    <>
      <ScrollView contentContainerStyle={estilos.conteudoComNav}>
        <TopoDetalhe
          titulo={cliente.nome}
          subtitulo="Ficha do cliente"
          onVoltar={onVoltar}
          acao={
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <BotaoIcone icone="create-outline" rotulo="Editar cliente" onPress={() => setEdicaoAberta(true)} />
              <Botao titulo="Compra" icone="cash-outline" compacto onPress={() => setCompraAberta(true)} />
            </View>
          }
        />
        <Cartao>
          <View style={estilos.linhaComIcone}>
            <Avatar nome={cliente.nome} tamanho={52} />
            <View style={{ flex: 1 }}>
              <Titulo nivel={3}>{cliente.nome}</Titulo>
              <Apoio>{documento(cliente.documento)} • {telefone(cliente.telefone)}</Apoio>
              {cliente.email ? <Apoio>{cliente.email}</Apoio> : null}
            </View>
            <Selo tom={cliente.situacao === "ATIVO" ? "success" : "neutral"}>{cliente.situacao}</Selo>
          </View>
          <Divisor />
          <Linha rotulo="Cartão">{cliente.codigoCartao}</Linha>
          <Linha rotulo="Total gasto">{moeda(cliente.totalGasto)}</Linha>
          <Linha rotulo="Cliente desde">{data(cliente.criadoEm)}</Linha>
        </Cartao>

        {premiosPendentes.length > 0 ? (
          <Secao titulo={premiosPendentes.length === 1 ? "Prêmio para retirar" : "Prêmios para retirar"}>
            {premiosPendentes.map((item) => (
              <Cartao key={item.id} destaque>
                <Linha rotulo={item.premio}><Texto>{item.codigo}</Texto></Linha>
                <Apoio>{item.campanha} • solicitado {desde(item.solicitadoEm)}</Apoio>
              </Cartao>
            ))}
          </Secao>
        ) : null}

        <Secao titulo="Cartões fidelidade">
          {ficha.data.cartoes.length ? ficha.data.cartoes.map((item) => (
            <Pressable key={`${item.empresa}-${item.campanhaId}`} onPress={() => onAbrirCampanha(item.campanhaId)} accessibilityRole="button" accessibilityLabel={`Abrir ${item.campanha}`}>
              <Cartao>
                <Titulo nivel={3}>{item.premio}</Titulo>
                <Apoio>{item.empresa} • {item.campanha}</Apoio>
                <Selos atuais={item.selosAtuais} necessarios={item.selosNecessarios} />
                {item.vezesCompletado > 0 ? <Apoio>Já completou {item.vezesCompletado} {item.vezesCompletado === 1 ? "vez" : "vezes"}.</Apoio> : null}
              </Cartao>
            </Pressable>
          )) : <Vazio texto="Nenhum cartão fidelidade ativo para este cliente." />}
        </Secao>

        <Secao titulo="Sorteios">
          {ficha.data.sorteios.length ? ficha.data.sorteios.map((item) => (
            <Pressable key={`${item.empresa}-${item.campanhaId}`} onPress={() => onAbrirCampanha(item.campanhaId)} accessibilityRole="button" accessibilityLabel={`Abrir ${item.campanha}`}>
              <Cartao>
                <View style={estilos.linhaEntre}>
                  <View style={{ flex: 1 }}>
                    <Titulo nivel={3}>{item.premio}</Titulo>
                    <Apoio>{item.empresa} • {item.campanha}</Apoio>
                  </View>
                  <Selo tom={tomCampanha(item.situacao)}>{ROTULO_SITUACAO_CAMPANHA[item.situacao]}</Selo>
                </View>
                <Linha rotulo="Cupons">{item.cupons}</Linha>
              </Cartao>
            </Pressable>
          )) : <Vazio texto="Este cliente ainda não participa de sorteios." />}
        </Secao>

        <Secao titulo="Últimas compras">
          {ficha.data.compras.length ? ficha.data.compras.slice(0, 10).map((item) => (
            <Cartao key={item.lancamento.id}>
              <View style={estilos.linhaEntre}>
                <View style={{ flex: 1 }}>
                  <Texto>{item.campanha}</Texto>
                  <Apoio>{dataHora(item.lancamento.criadoEm)} • {item.lancamento.quantidadeBeneficio} {item.lancamento.tipoBeneficio === "SELOS" ? "selos" : "cupons"}</Apoio>
                </View>
                <Texto style={{ fontWeight: fontWeight.semibold }}>{moeda(item.lancamento.valorCompra)}</Texto>
              </View>
              {item.lancamento.situacao === "CANCELADO" ? <Selo tom="danger">Cancelado</Selo> : null}
            </Cartao>
          )) : <Vazio texto="Nenhuma compra registrada para este cliente." />}
        </Secao>

        {premiosRecebidos.length > 0 ? (
          <Secao titulo="Prêmios recebidos">
            {premiosRecebidos.map((item) => (
              <Cartao key={item.id}>
                <Linha rotulo={item.premio}><Selo tom={tomEntrega(item.situacao)}>{ROTULO_SITUACAO_ENTREGA[item.situacao]}</Selo></Linha>
                <Apoio>{item.campanha} • {item.entregueEm ? data(item.entregueEm) : data(item.solicitadoEm)}</Apoio>
              </Cartao>
            ))}
          </Secao>
        ) : null}
      </ScrollView>
      <FormularioCompra cliente={compraAberta ? cliente : null} onFechar={() => setCompraAberta(false)} />
      <FormularioEditarCliente
        cliente={edicaoAberta ? cliente : null}
        onFechar={() => setEdicaoAberta(false)}
      />
    </>
  );
}

function TopoDetalhe({ titulo, subtitulo, onVoltar, acao }: { titulo: string; subtitulo?: string; onVoltar: () => void; acao?: ReactNode }) {
  return (
    <View style={estilos.topoDetalhe}>
      <BotaoIcone icone="arrow-back" rotulo="Voltar" onPress={onVoltar} />
      <View style={{ flex: 1 }}>
        <Titulo nivel={2}>{titulo}</Titulo>
        {subtitulo ? <Apoio>{subtitulo}</Apoio> : null}
      </View>
      {acao}
    </View>
  );
}

function Entregas() {
  const [busca, setBusca] = useState("");
  const [situacoes, setSituacoes] = useState<SituacaoEntrega[]>(["AGUARDANDO"]);
  const [detalheSelecionada, setDetalheSelecionada] = useState<Entrega | null>(null);
  const [entregaSelecionada, setEntregaSelecionada] = useState<Entrega | null>(null);
  const [cancelarSelecionada, setCancelarSelecionada] = useState<Entrega | null>(null);
  const query = useEntregas({ busca, situacao: situacoes, tamanho: 80 });

  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Entregas" />
      <Busca valor={busca} onChange={setBusca} placeholder="Cliente, prêmio ou código" />
      <Filtros<SituacaoEntrega> selecionados={situacoes} onChange={setSituacoes} opcoes={["AGUARDANDO", "ENTREGUE", "CANCELADA"].map((valor) => ({ valor: valor as SituacaoEntrega, rotulo: ROTULO_SITUACAO_ENTREGA[valor as SituacaoEntrega] }))} />
      <FlatList
        data={query.data?.content ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.listaComNav}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhuma entrega encontrada." />}
        renderItem={({ item }) => (
          <Cartao destaque={item.situacao === "AGUARDANDO"}>
            <View style={estilos.linhaEntre}>
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => setDetalheSelecionada(item)} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${item.premio}`}>
                  <Titulo nivel={3}>{item.premio}</Titulo>
                </Pressable>
                <Apoio>{item.cliente} • {telefone(item.telefoneCliente)}</Apoio>
              </View>
              <Pressable onPress={() => setDetalheSelecionada(item)} accessibilityRole="button" accessibilityLabel="Ver detalhes da entrega">
                <Selo tom={tomEntrega(item.situacao)}>{ROTULO_SITUACAO_ENTREGA[item.situacao]}</Selo>
              </Pressable>
            </View>
            <Linha rotulo="Código">{item.codigo}</Linha>
            <Linha rotulo="Campanha">{item.campanha}</Linha>
            <Apoio>{item.instrucoesRetirada ?? "Sem instrução específica"} • {desde(item.solicitadoEm)}</Apoio>
            <View style={estilos.acoesLinha}>
              <Botao titulo="Detalhes" icone="information-circle-outline" variante="secundario" compacto onPress={() => setDetalheSelecionada(item)} />
              {item.situacao === "AGUARDANDO" ? (
                <>
                <Botao titulo="Confirmar" icone="checkmark" compacto onPress={() => setEntregaSelecionada(item)} />
                <Botao titulo="Cancelar" variante="perigo" compacto onPress={() => setCancelarSelecionada(item)} />
                </>
              ) : null}
            </View>
          </Cartao>
        )}
      />
      <DetalheDaEntrega entrega={detalheSelecionada} onFechar={() => setDetalheSelecionada(null)} />
      <FormularioEntrega entrega={entregaSelecionada} onFechar={() => setEntregaSelecionada(null)} />
      <FormularioCancelarEntrega entrega={cancelarSelecionada} onFechar={() => setCancelarSelecionada(null)} />
    </View>
  );
}

function DetalheDaEntrega({ entrega, onFechar }: { entrega: Entrega | null; onFechar: () => void }) {
  return (
    <Folha visivel={Boolean(entrega)} titulo="Detalhes da entrega" onFechar={onFechar} grande>
      {entrega ? (
        <>
          <Cartao style={{ gap: spacing.sm }}>
            <Titulo nivel={3}>{entrega.premio}</Titulo>
            <Apoio>{entrega.campanha}</Apoio>
            <Divisor />
            <Linha rotulo="Status"><Selo tom={tomEntrega(entrega.situacao)}>{ROTULO_SITUACAO_ENTREGA[entrega.situacao]}</Selo></Linha>
            <Linha rotulo="Cliente">{entrega.cliente}</Linha>
            <Linha rotulo="Telefone">{telefone(entrega.telefoneCliente)}</Linha>
            <Linha rotulo="Código">{entrega.codigo}</Linha>
            <Linha rotulo="Solicitado">{data(entrega.solicitadoEm)}</Linha>
            {entrega.entregueEm ? <Linha rotulo="Entregue">{data(entrega.entregueEm)}</Linha> : null}
          </Cartao>

          {entrega.situacao === "ENTREGUE" ? (
            <Cartao style={{ gap: spacing.sm }}>
              <Titulo nivel={3}>Registro da baixa</Titulo>
              <Linha rotulo="Conferido por">{entrega.documentoConferido || "Não informado"}</Linha>
              <Linha rotulo="Terceiro">{entrega.entregueParaTerceiro ? "Sim" : "Não"}</Linha>
              {entrega.entregueParaTerceiro ? (
                <>
                  <Linha rotulo="Quem retirou">{entrega.recebedorNome || "Não informado"}</Linha>
                  <Linha rotulo="Documento">{entrega.recebedorDocumento || "Não informado"}</Linha>
                </>
              ) : null}
            </Cartao>
          ) : null}

          {entrega.instrucoesRetirada ? (
            <Cartao style={{ gap: spacing.xs }}>
              <Rotulo>Como retirar</Rotulo>
              <Texto>{entrega.instrucoesRetirada}</Texto>
            </Cartao>
          ) : null}

          {entrega.observacao ? (
            <Cartao style={{ gap: spacing.xs }}>
              <Rotulo>Observação</Rotulo>
              <Texto>{entrega.observacao}</Texto>
            </Cartao>
          ) : null}

          <Botao titulo="Fechar" variante="secundario" largura="cheia" onPress={onFechar} />
        </>
      ) : null}
    </Folha>
  );
}

function Lancamentos() {
  const [dias, setDias] = useState<"7" | "30" | "90">("30");
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const query = useAuditoria({ dias: Number(dias), busca, apenasMarcados: marcados.includes("marcados"), tamanho: 80 });
  const dados = query.data;

  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Lançamentos" />
      <Seletor rotulo="Período" valor={dias} onChange={setDias} opcoes={[{ valor: "7", rotulo: "7 dias" }, { valor: "30", rotulo: "30 dias" }, { valor: "90", rotulo: "90 dias" }]} />
      <Busca valor={busca} onChange={setBusca} placeholder="Cliente, campanha ou funcionário" />
      <Filtros selecionados={marcados} onChange={setMarcados} opcoes={[{ valor: "marcados", rotulo: "Com sinais" }]} />
      <FlatList
        data={dados?.linhas.content ?? []}
        keyExtractor={(item) => item.lancamento.id}
        contentContainerStyle={estilos.listaComNav}
        ListHeaderComponent={dados ? (
          <Secao titulo="Resumo por funcionário" style={{ marginBottom: spacing.md }}>
            {dados.resumo.map((item) => (
              <Cartao key={item.usuarioId} destaque={item.sinais.length > 0}>
                <Linha rotulo={item.nome}><Texto>{moeda(item.valorTotal)}</Texto></Linha>
                <Apoio>{item.confirmados} confirmados • {item.cancelados} cancelados • {item.clientesDistintos} clientes</Apoio>
                {item.sinais.map((sinal) => <Selo key={sinal.id} tom={sinal.gravidade === "ALERTA" ? "danger" : "warning"}>{sinal.rotulo}</Selo>)}
              </Cartao>
            ))}
          </Secao>
        ) : null}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhum lançamento encontrado." />}
        renderItem={({ item }) => (
          <Cartao destaque={item.marcas.length > 0}>
            <View style={estilos.linhaEntre}>
              <Titulo nivel={3}>{item.cliente}</Titulo>
              <Selo tom={item.lancamento.situacao === "CONFIRMADO" ? "success" : "danger"}>{item.lancamento.situacao}</Selo>
            </View>
            <Linha rotulo="Valor">{moeda(item.lancamento.valorCompra)}</Linha>
            <Apoio>{item.campanha} • {item.usuario} • {dataHora(item.lancamento.criadoEm)}</Apoio>
            {item.marcas.map((marca) => <Selo key={marca} tom="warning">{marca}</Selo>)}
          </Cartao>
        )}
      />
    </View>
  );
}

function Equipe({ perfil }: { perfil: Perfil }) {
  const [formAberto, setFormAberto] = useState(false);
  const query = useEquipe();
  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Equipe" acao={<Botao titulo="Novo" icone="person-add-outline" compacto onPress={() => setFormAberto(true)} />} />
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.usuario.id}
        contentContainerStyle={estilos.listaComNav}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhum membro encontrado." />}
        renderItem={({ item }) => <MembroCard item={item} />}
      />
      <FormularioMembro perfil={perfil} visivel={formAberto} onFechar={() => setFormAberto(false)} />
    </View>
  );
}

function MembroCard({ item }: { item: Membro }) {
  return (
    <Cartao>
      <View style={estilos.linhaComIcone}>
        <Avatar nome={item.usuario.nome} />
        <View style={{ flex: 1 }}>
          <Titulo nivel={3}>{item.usuario.nome}</Titulo>
          <Apoio>{item.usuario.email}</Apoio>
        </View>
        <Selo tom={item.usuario.situacao === "ATIVO" ? "success" : "neutral"}>{ROTULO_PERFIL[item.usuario.perfil]}</Selo>
      </View>
      <Linha rotulo="Lançamentos no mês">{item.lancamentosNoMes}</Linha>
    </Cartao>
  );
}

function Empresas() {
  const [formAberto, setFormAberto] = useState(false);
  const [editar, setEditar] = useState<Empresa | null>(null);
  const query = useTodasEmpresas(true);
  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Empresas" acao={<Botao titulo="Nova" icone="business-outline" compacto onPress={() => setFormAberto(true)} />} />
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.listaComNav}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhuma empresa encontrada." />}
        renderItem={({ item }) => (
          <Cartao>
            <View style={estilos.linhaEntre}>
              <View style={{ flex: 1 }}>
                <Titulo nivel={3}>{item.nomeFantasia}</Titulo>
                <Apoio>{documento(item.documento)} • {item.cidade ? `${item.cidade}/${item.uf}` : "Sem cidade"}</Apoio>
              </View>
              <Selo tom={item.situacao === "ATIVA" ? "success" : "neutral"}>{item.situacao}</Selo>
            </View>
            <Linha rotulo="Contato">{item.telefone ? telefone(item.telefone) : item.email ?? "Não informado"}</Linha>
            <Botao titulo="Editar" variante="secundario" compacto onPress={() => setEditar(item)} />
          </Cartao>
        )}
      />
      <FormularioEmpresa visivel={formAberto} onFechar={() => setFormAberto(false)} />
      <FormularioEditarEmpresa empresa={editar} onFechar={() => setEditar(null)} />
    </View>
  );
}

function BarraLista({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <View style={estilos.linhaEntre}>
      <Titulo nivel={2}>{titulo}</Titulo>
      {acao}
    </View>
  );
}

/**
 * Edição do cadastro do cliente.
 *
 * Mesmos campos do cadastro, menos o documento: ele identifica a pessoa, e
 * trocá-lo transformaria este cadastro em outro — com os selos do antigo. O
 * servidor também recusa a troca.
 *
 * A captura facial é a mesma do cadastro, e resolve os dois casos que aparecem
 * no balcão: quem não registrou o rosto na primeira vez, e quem mudou de
 * aparência e deixou de ser reconhecido.
 */
function FormularioEditarCliente({ cliente, onFechar }: { cliente: Cliente | null; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCliente>("ATIVO");
  const [vetorFacial, setVetorFacial] = useState<number[]>();
  const [cameraFacialAberta, setCameraFacialAberta] = useState(false);

  const editar = useEditarCliente(onFechar);

  /*
   * Abrir a folha recomeça do que está gravado. Sem isto, quem fecha no meio de
   * uma edição e reabre encontra o rascunho antigo — inclusive uma captura
   * facial que havia desistido de salvar.
   */
  useEffect(() => {
    if (!cliente) return;
    setNome(cliente.nome);
    setFone(cliente.telefone);
    setSituacao(cliente.situacao);
    setVetorFacial(undefined);
  }, [cliente]);

  return (
    <>
      <Folha visivel={Boolean(cliente) && !cameraFacialAberta} titulo="Editar cliente" onFechar={onFechar}>
        <Campo rotulo="Nome" valor={nome} onChange={setNome} />
        <Campo rotulo="Telefone" valor={fone} onChange={setFone} teclado="phone-pad" />
        <Apoio>É para onde vão os avisos de selo e prêmio, no WhatsApp.</Apoio>
        <Seletor<SituacaoCliente>
          rotulo="Situação"
          valor={situacao}
          onChange={setSituacao}
          opcoes={[
            { valor: "ATIVO", rotulo: "Ativo" },
            { valor: "INATIVO", rotulo: "Inativo" },
          ]}
        />
        <Cartao destaque={Boolean(vetorFacial)}>
          <View style={estilos.linhaEntre}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Rotulo>Reconhecimento facial</Rotulo>
              <Apoio>
                {vetorFacial
                  ? "Rosto capturado. A foto não será salva."
                  : "Capture de novo se o cliente deixou de ser reconhecido."}
              </Apoio>
            </View>
            {vetorFacial ? <Icone nome="checkmark-circle" cor={colors.success} tamanho={28} /> : null}
          </View>
          <Botao
            titulo={vetorFacial ? "Capturar novamente" : "Usar câmera"}
            icone="camera-outline"
            variante="secundario"
            largura="cheia"
            onPress={() => setCameraFacialAberta(true)}
          />
        </Cartao>
        <Apoio>
          O CPF {documento(cliente?.documento ?? "")} não muda — ele identifica o cliente e
          carrega os selos dele.
        </Apoio>
        <Botao
          titulo="Salvar"
          largura="cheia"
          carregando={editar.isPending}
          onPress={() => {
            if (!cliente) return;
            editar.mutate({
              id: cliente.id,
              nome,
              telefone: fone,
              situacao,
              vetorFacial,
              consentimentoFacial: Boolean(vetorFacial),
            });
          }}
        />
      </Folha>
      <ReconhecimentoFacial
        visivel={cameraFacialAberta}
        modo="cadastro"
        titulo="Cadastrar rosto"
        onFechar={() => setCameraFacialAberta(false)}
        onConcluir={(vetor) => {
          setVetorFacial(vetor);
          setCameraFacialAberta(false);
          avisar.sucesso("Rosto capturado. Nenhuma foto foi salva.");
        }}
      />
    </>
  );
}

function FormularioCliente({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [fone, setFone] = useState("");
  const [vetorFacial, setVetorFacial] = useState<number[]>();
  const [cameraFacialAberta, setCameraFacialAberta] = useState(false);
  const criar = useCriarCliente(() => {
    setNome(""); setDoc(""); setFone(""); setVetorFacial(undefined); onFechar();
  });
  return (
    <>
      <Folha visivel={visivel && !cameraFacialAberta} titulo="Novo cliente" onFechar={onFechar}>
        <Campo rotulo="Nome" valor={nome} onChange={setNome} />
        <Campo rotulo="CPF" valor={doc} onChange={setDoc} teclado="numeric" />
        <Campo rotulo="Telefone" valor={fone} onChange={setFone} teclado="phone-pad" />
        <Cartao destaque={Boolean(vetorFacial)}>
          <View style={estilos.linhaEntre}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Rotulo>Reconhecimento facial</Rotulo>
              <Apoio>
                {vetorFacial
                  ? "Rosto capturado. A foto não será salva."
                  : "Opcional. Cadastre o rosto para identificação rápida."}
              </Apoio>
            </View>
            {vetorFacial ? <Icone nome="checkmark-circle" cor={colors.success} tamanho={28} /> : null}
          </View>
          <Botao
            titulo={vetorFacial ? "Capturar novamente" : "Usar câmera"}
            icone="camera-outline"
            variante="secundario"
            largura="cheia"
            onPress={() => setCameraFacialAberta(true)}
          />
        </Cartao>
        <Botao
          titulo="Cadastrar"
          largura="cheia"
          carregando={criar.isPending}
          onPress={() => criar.mutate({
            nome,
            documento: doc,
            telefone: fone,
            vetorFacial,
            consentimentoFacial: Boolean(vetorFacial),
          })}
        />
      </Folha>
      <ReconhecimentoFacial
        visivel={cameraFacialAberta}
        modo="cadastro"
        titulo="Cadastrar rosto"
        onFechar={() => setCameraFacialAberta(false)}
        onConcluir={(vetor) => {
          setVetorFacial(vetor);
          setCameraFacialAberta(false);
          avisar.sucesso("Rosto capturado. Nenhuma foto foi salva.");
        }}
      />
    </>
  );
}

function FormularioCompra({ cliente, onFechar }: { cliente: Cliente | null; onFechar: () => void }) {
  const [campanhaId, setCampanhaId] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const campanhas = useCampanhas({ situacao: ["ATIVA"], tamanho: 50 });
  const registrar = useRegistrarCompra(() => {
    setValor(null);
    setCampanhaId("");
    onFechar();
  });
  const opcoes = useMemo(() => (campanhas.data?.content ?? []).map((item) => ({
    valor: item.id,
    rotulo: item.nome,
    dica: item.regraEmUmaFrase,
  })), [campanhas.data]);
  return (
    <Folha visivel={Boolean(cliente)} titulo={cliente ? `Compra de ${cliente.nome}` : "Registrar compra"} onFechar={onFechar}>
      {campanhas.isLoading ? <CarregandoBloco /> : campanhas.isError ? <ErroBloco /> : opcoes.length ? (
        <Seletor rotulo="Campanha" valor={campanhaId || null} onChange={setCampanhaId} opcoes={opcoes} coluna />
      ) : (
        <Vazio texto="Nenhuma campanha no ar. Publique uma campanha antes de lançar compra." />
      )}
      <CampoMoeda rotulo="Valor da compra" centavos={valor} onChange={setValor} />
      <Botao titulo="Registrar compra" icone="cash-outline" largura="cheia" carregando={registrar.isPending} onPress={() => {
        if (!cliente || !campanhaId || !valor) return avisar.erro("Selecione campanha e informe um valor.");
        registrar.mutate({ clienteId: cliente.id, campanhaId, valorCompra: valor });
      }} />
    </Folha>
  );
}

function FormularioCompraRapida({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [codigoCliente, setCodigoCliente] = useState("");
  const [campanhaId, setCampanhaId] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [cameraFacialAberta, setCameraFacialAberta] = useState(false);
  const [clienteFacial, setClienteFacial] = useState<Cliente | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const clientes = useClientes({ busca: buscaCliente, tamanho: 12 });
  const campanhas = useCampanhas({ situacao: ["ATIVA"], tamanho: 50 });
  const registrar = useRegistrarCompra(() => {
    setBuscaCliente("");
    setClienteId("");
    setCodigoCliente("");
    setClienteFacial(null);
    setCampanhaId("");
    setValor(null);
    onFechar();
  });
  const opcoesClientes = useMemo(
    () => [
      ...(clienteFacial && !clientes.data?.content.some((item) => item.id === clienteFacial.id)
        ? [clienteFacial]
        : []),
      ...(clientes.data?.content ?? []),
    ].map((item) => ({
      valor: item.id,
      rotulo: item.nome,
      dica: `${documento(item.documento)} • ${item.codigoCartao}`,
    })),
    [clientes.data, clienteFacial],
  );
  const opcoesCampanhas = useMemo(
    () => (campanhas.data?.content ?? []).map((item) => ({
      valor: item.id,
      rotulo: item.nome,
      dica: item.regraEmUmaFrase,
    })),
    [campanhas.data],
  );

  return (
    <>
      <Folha visivel={visivel && !scannerAberto && !cameraFacialAberta} titulo="Registrar compra" onFechar={onFechar}>
      <View style={estilos.linhaEntre}>
        <View style={{ flex: 1 }}>
          <Rotulo>Cliente</Rotulo>
          <Apoio>Reconheça o rosto, leia o QR ou faça a busca manual.</Apoio>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Botao titulo="Buscar rosto" icone="scan-outline" compacto onPress={() => setCameraFacialAberta(true)} />
          <Botao titulo="Ler QR" icone="qr-code-outline" variante="secundario" compacto onPress={async () => {
            if (!permission?.granted) {
              const resposta = await requestPermission();
              if (!resposta.granted) {
                avisar.erro("Permita o uso da câmera para ler o QR Code.");
                return;
              }
            }
            setScannerAberto(true);
          }} />
        </View>
      </View>
      <Busca
        valor={buscaCliente}
        onChange={(texto) => {
          setBuscaCliente(texto);
          setCodigoCliente("");
          setClienteFacial(null);
        }}
        placeholder="CPF, cartão, nome ou telefone"
      />
      {clientes.isLoading ? <CarregandoBloco /> : clientes.isError ? <ErroBloco /> : opcoesClientes.length ? (
        <Seletor
          rotulo="Cliente"
          valor={clienteId || null}
          onChange={(valor) => {
            setClienteId(valor);
            setCodigoCliente("");
          }}
          opcoes={opcoesClientes}
          coluna
        />
      ) : (
        <Vazio texto={buscaCliente ? "Nenhum cliente encontrado para essa busca." : "Digite para buscar o cliente pelo nome, documento ou cartão."} />
      )}
      {!clienteId && codigoCliente ? (
        <Cartao destaque>
          <Rotulo>QR lido</Rotulo>
          <Texto>{codigoCliente}</Texto>
          <Apoio>Se a pessoa existir em outra loja, o lançamento cria o vínculo nesta empresa.</Apoio>
        </Cartao>
      ) : null}
      {campanhas.isLoading ? <CarregandoBloco /> : campanhas.isError ? <ErroBloco /> : opcoesCampanhas.length ? (
        <Seletor rotulo="Campanha" valor={campanhaId || null} onChange={setCampanhaId} opcoes={opcoesCampanhas} coluna />
      ) : (
        <Vazio texto="Nenhuma campanha no ar. Publique uma campanha antes de lançar compra." />
      )}
      <CampoMoeda rotulo="Valor da compra" centavos={valor} onChange={setValor} />
      <Botao titulo="Registrar compra" icone="cash-outline" largura="cheia" carregando={registrar.isPending} onPress={() => {
        if ((!clienteId && !codigoCliente) || !campanhaId || !valor) return avisar.erro("Selecione cliente ou leia o QR, campanha e valor.");
        registrar.mutate({
          clienteId: clienteId || undefined,
          codigoCliente: codigoCliente || undefined,
          campanhaId,
          valorCompra: valor,
        });
      }} />
      </Folha>
      <ScannerQrCliente
        visivel={scannerAberto}
        onFechar={() => setScannerAberto(false)}
        onLer={(valor) => {
          const busca = textoBuscaDoQr(valor);
          setCodigoCliente(busca);
          setBuscaCliente(busca);
          setClienteId("");
          setClienteFacial(null);
          setScannerAberto(false);
          avisar.informacao("QR lido. Confira o cliente encontrado.");
        }}
      />
      <ReconhecimentoFacial
        visivel={cameraFacialAberta}
        modo="reconhecimento"
        titulo="Buscar cliente pelo rosto"
        onFechar={() => setCameraFacialAberta(false)}
        onConcluir={async (vetor) => {
          try {
            const reconhecido = await servico.reconhecerClientePorRosto(vetor);
            const ficha = await servico.obterFichaCliente(reconhecido.clienteId);
            setClienteFacial(ficha.cliente);
            setClienteId(ficha.cliente.id);
            setCodigoCliente("");
            setBuscaCliente("");
            setCameraFacialAberta(false);
            avisar.sucesso(`${ficha.cliente.nome} identificado pelo rosto.`);
          } catch (erro) {
            avisar.erro(mensagemDoErro(erro));
            throw erro;
          }
        }}
      />
    </>
  );
}

function ScannerQrCliente({ visivel, onFechar, onLer }: { visivel: boolean; onFechar: () => void; onLer: (valor: string) => void }) {
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    if (visivel) setBloqueado(false);
  }, [visivel]);

  const aoLer = (resultado: BarcodeScanningResult) => {
    if (bloqueado || !resultado.data) return;
    setBloqueado(true);
    onLer(resultado.data);
  };

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <SafeAreaView style={estilos.safe}>
        <View style={estilos.scannerHeader}>
          <View style={{ flex: 1 }}>
            <Titulo nivel={2}>Ler QR do cliente</Titulo>
            <Apoio>Aponte para o QR do cartão Fideliza+.</Apoio>
          </View>
          <BotaoIcone icone="close" rotulo="Fechar" onPress={onFechar} />
        </View>
        <CameraView
          style={estilos.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={bloqueado ? undefined : aoLer}
        >
          <View style={estilos.miraQr}>
            <View style={estilos.miraCaixa} />
          </View>
        </CameraView>
      </SafeAreaView>
    </Modal>
  );
}

function textoBuscaDoQr(valor: string) {
  const bruto = valor.trim();
  if (!bruto) return "";

  try {
    const url = new URL(bruto);
    const chaves = ["codigoCartao", "cartao", "codigo", "cpf", "cnpj", "documento", "cliente"];
    for (const chave of chaves) {
      const lido = url.searchParams.get(chave);
      if (lido) return lido.trim();
    }
    const ultimoSegmento = url.pathname.split("/").filter(Boolean).at(-1);
    if (ultimoSegmento) return decodeURIComponent(ultimoSegmento);
  } catch {
    // QR simples: usa o próprio conteúdo.
  }

  return bruto;
}

function FormularioCampanha({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const session = useSession((estado) => estado.session);
  const empresaAtiva = session?.empresas.find((empresa) => empresa.id === session.empresaAtivaId);
  const nomeEmpresa = empresaAtiva?.nomeFantasia ?? "";
  const [abaCampanha, setAbaCampanha] = useState<"geral" | "configuracoes">("geral");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoCampanha>("CARTAO_FIDELIDADE");
  const [inicio, setInicio] = useState(dataInput(0));
  const [fim, setFim] = useState(dataInput(90));
  const [sorteio, setSorteio] = useState(dataInput(93));
  const [selosNecessarios, setSelosNecessarios] = useState("10");
  const [valorPorCupom, setValorPorCupom] = useState<number | null>(2000);
  const [quantidadeGanhadores, setQuantidadeGanhadores] = useState("1");
  const [limiteTotalCupons, setLimiteTotalCupons] = useState("");
  const [valorMinimoCompra, setValorMinimoCompra] = useState<number | null>(null);
  const [limiteDiarioCliente, setLimiteDiarioCliente] = useState("1");
  const [premio, setPremio] = useState("");
  const [descricaoPremio, setDescricaoPremio] = useState("");
  const [quantidadePremio, setQuantidadePremio] = useState("1");
  const [instrucoesRetirada, setInstrucoesRetirada] = useState("");
  const [funcionarioPodePublicar, setFuncionarioPodePublicar] = useState(false);
  const [funcionarioPodePausar, setFuncionarioPodePausar] = useState(false);
  const [funcionarioPodeEncerrar, setFuncionarioPodeEncerrar] = useState(false);
  const [funcionarioPodeSortear, setFuncionarioPodeSortear] = useState(false);
  const criar = useCriarCampanha(() => {
    limparFormularioCampanha();
    onFechar();
  });
  const isCartao = tipo === "CARTAO_FIDELIDADE";

  function limparFormularioCampanha() {
    setAbaCampanha("geral");
    setDescricao("");
    setTipo("CARTAO_FIDELIDADE");
    setInicio(dataInput(0));
    setFim(dataInput(90));
    setSorteio(dataInput(93));
    setSelosNecessarios("10");
    setValorPorCupom(2000);
    setQuantidadeGanhadores("1");
    setLimiteTotalCupons("");
    setValorMinimoCompra(null);
    setLimiteDiarioCliente("1");
    setPremio("");
    setDescricaoPremio("");
    setQuantidadePremio("1");
    setInstrucoesRetirada("");
    setFuncionarioPodePublicar(false);
    setFuncionarioPodePausar(false);
    setFuncionarioPodeEncerrar(false);
    setFuncionarioPodeSortear(false);
  }

  function escolherTipo(proximo: TipoCampanha) {
    setTipo(proximo);
    if (proximo === "CARTAO_FIDELIDADE") {
      setSelosNecessarios("10");
      setLimiteDiarioCliente("1");
      return;
    }
    setValorPorCupom(2000);
    setQuantidadeGanhadores("1");
    setLimiteTotalCupons("");
    setLimiteDiarioCliente("20");
    setSorteio(dataInput(93));
  }

  function salvar(publicar: boolean) {
    const nome = nomeEmpresa.trim();
    const textoDescricao = descricao.trim();
    const nomePremio = premio.trim();
    const qtdPremio = inteiroCampo(quantidadePremio);
    const limiteDia = inteiroCampo(limiteDiarioCliente);
    const limiteCupons = inteiroCampo(limiteTotalCupons);
    const dataInicio = dataFormulario(inicio, "inicio");
    const dataFim = dataFormulario(fim, "fim");
    const dataSorteio = isCartao ? null : dataFormulario(sorteio, "sorteio");

    if (!nome) return avisar.erro("Selecione uma empresa ativa antes de criar campanha.");
    if (nome.length < 3) return avisar.erro("O nome da empresa está curto demais para virar nome da campanha.");
    if (!textoDescricao) return avisar.erro("Explique a campanha em uma frase.");
    if (textoDescricao.length > 160) return avisar.erro("Use no máximo 160 caracteres na frase da campanha.");
    if (!dataInicio || !dataFim) return avisar.erro("Informe início e término no formato AAAA-MM-DD.");
    if (dataFim.getTime() < dataInicio.getTime()) return avisar.erro("O término não pode ser antes do início.");
    if (!nomePremio) return avisar.erro("Diga o que o cliente ganha.");
    if (!qtdPremio || qtdPremio < 1 || qtdPremio > 9999) return avisar.erro("Informe quantos prêmios existem.");
    if (!limiteDia || limiteDia < 1 || limiteDia > 100) return avisar.erro("O limite diário deve ficar entre 1 e 100.");

    if (isCartao) {
      const selos = inteiroCampo(selosNecessarios);
      if (!selos || selos < 2 || selos > 30) return avisar.erro("Diga quantos selos completam o cartão, entre 2 e 30.");
      criar.mutate({
        nome,
        descricao: textoDescricao,
        tipo,
        iniciaEm: isoDaData(dataInicio, "inicio"),
        terminaEm: isoDaData(dataFim, "fim"),
        valorMinimoCompra: valorMinimoCompra || undefined,
        selosNecessarios: selos,
        limiteDiarioCliente: limiteDia,
        nomePremio,
        descricaoPremio: descricaoPremio.trim() || undefined,
        quantidadePremio: qtdPremio,
        instrucoesRetirada: instrucoesRetirada.trim() || undefined,
        funcionarioPodePublicar,
        funcionarioPodePausar,
        funcionarioPodeEncerrar,
        funcionarioPodeSortear: false,
        publicar,
      });
      return;
    }

    const ganhadores = inteiroCampo(quantidadeGanhadores);
    if (!valorPorCupom || valorPorCupom <= 0) return avisar.erro("Diga de quanto em quanto o cliente ganha um cupom.");
    if (!ganhadores || ganhadores < 1 || ganhadores > 50) return avisar.erro("Informe quantos ganhadores o sorteio terá.");
    if (limiteTotalCupons.trim() && (!limiteCupons || limiteCupons < 1)) return avisar.erro("O limite total de cupons precisa ser maior que zero.");
    if (!dataSorteio) return avisar.erro("Informe a data do sorteio no formato AAAA-MM-DD.");
    if (dataSorteio.getTime() < dataFim.getTime()) return avisar.erro("O sorteio precisa ser depois do término da campanha.");

    criar.mutate({
      nome,
      descricao: textoDescricao,
      tipo,
      iniciaEm: isoDaData(dataInicio, "inicio"),
      terminaEm: isoDaData(dataFim, "fim"),
      sorteiaEm: isoDaData(dataSorteio, "sorteio"),
      valorMinimoCompra: valorMinimoCompra || undefined,
      valorPorCupom,
      quantidadeGanhadores: ganhadores,
      limiteTotalCupons: limiteCupons ?? undefined,
      limiteDiarioCliente: limiteDia,
      nomePremio,
      descricaoPremio: descricaoPremio.trim() || undefined,
      quantidadePremio: qtdPremio,
      instrucoesRetirada: instrucoesRetirada.trim() || undefined,
      funcionarioPodePublicar,
      funcionarioPodePausar,
      funcionarioPodeEncerrar,
      funcionarioPodeSortear,
      publicar,
    });
  }

  return (
    <Folha visivel={visivel} titulo="Nova campanha" onFechar={onFechar}>
      <Seletor<"geral" | "configuracoes">
        rotulo="Aba"
        valor={abaCampanha}
        onChange={setAbaCampanha}
        opcoes={[
          { valor: "geral", rotulo: "Geral" },
          { valor: "configuracoes", rotulo: "Configurações" },
        ]}
      />

      {abaCampanha === "geral" ? (
        <>
          <Secao titulo="Tipo">
            <Seletor<TipoCampanha>
              valor={tipo}
              onChange={escolherTipo}
              coluna
              opcoes={[
                { valor: "CARTAO_FIDELIDADE", rotulo: "Cartão fidelidade", dica: "Cada compra dá selo. Ao completar o cartão, o cliente ganha o prêmio." },
                { valor: "SORTEIO", rotulo: "Sorteio", dica: "Cada valor gasto vira cupom. No fim da campanha, você sorteia o prêmio." },
              ]}
            />
          </Secao>

          <Secao titulo="Informações gerais">
            <Campo rotulo="Nome da campanha" valor={nomeEmpresa} onChange={() => undefined} editavel={false} dica="É o nome da empresa ativa. Para mudar, edite a empresa." />
            <Campo rotulo="Explique em uma frase" valor={descricao} onChange={setDescricao} multilinha maxLength={160} placeholder={isCartao ? "Compre 10 açaís e ganhe 1 grátis." : "A cada R$ 20,00, você ganha um cupom para concorrer."} dica="É o que o funcionário fala para o cliente." />
          </Secao>

          <Secao titulo="O que o cliente ganha">
            <Campo rotulo="Prêmio" valor={premio} onChange={setPremio} placeholder={isCartao ? "Açaí de 500 ml grátis" : "Honda Pop 110i 0 km"} maxLength={80} />
            <Campo rotulo="Descrição do prêmio" valor={descricaoPremio} onChange={setDescricaoPremio} multilinha maxLength={300} placeholder="Detalhes do prêmio, quando precisar." />
            <Campo rotulo="Quantos você tem?" valor={quantidadePremio} onChange={setQuantidadePremio} teclado="number-pad" placeholder="1" />
            <Campo rotulo="Como o cliente retira" valor={instrucoesRetirada} onChange={setInstrucoesRetirada} multilinha maxLength={300} placeholder="Apresente o código no caixa. Válido para consumo no local." />
          </Secao>
        </>
      ) : (
        <>
          <Secao titulo="Regras da campanha">
            {isCartao ? (
              <Campo rotulo="Quantos selos completam o cartão?" valor={selosNecessarios} onChange={setSelosNecessarios} teclado="number-pad" placeholder="10" dica="Mínimo 2, máximo 30." />
            ) : (
              <>
                <CampoMoeda rotulo="A cada quanto ganha 1 cupom?" centavos={valorPorCupom} onChange={setValorPorCupom} dica="Mesmo padrão da web: valor em reais convertido para centavos." />
                <Campo rotulo="Quantos ganhadores?" valor={quantidadeGanhadores} onChange={setQuantidadeGanhadores} teclado="number-pad" placeholder="1" dica="Mínimo 1, máximo 50." />
                <Campo rotulo="Limite total de cupons" valor={limiteTotalCupons} onChange={(v) => setLimiteTotalCupons(v.replace(/\D/g, ""))} teclado="number-pad" placeholder="Opcional" dica="Ao atingir esse total, a campanha para de aceitar novos cupons." />
              </>
            )}
            <View style={estilos.gradeIndicadores}>
              <Campo rotulo="Começa em" valor={inicio} onChange={setInicio} teclado="numbers-and-punctuation" placeholder="AAAA-MM-DD" style={{ flex: 1 }} />
              <Campo rotulo="Termina em" valor={fim} onChange={setFim} teclado="numbers-and-punctuation" placeholder="AAAA-MM-DD" style={{ flex: 1 }} />
            </View>
            {!isCartao ? <Campo rotulo="Data do sorteio" valor={sorteio} onChange={setSorteio} teclado="numbers-and-punctuation" placeholder="AAAA-MM-DD" dica="Precisa ser depois do término da campanha." /> : null}
          </Secao>

          <Secao titulo="Limites opcionais">
            <CampoMoeda rotulo="Valor mínimo da compra" centavos={valorMinimoCompra} onChange={setValorMinimoCompra} dica="Deixe vazio ou zerado para valer qualquer compra." />
            <Campo rotulo="Máximo por cliente, por dia" valor={limiteDiarioCliente} onChange={setLimiteDiarioCliente} teclado="number-pad" dica="Evita dezenas de compras seguidas para a mesma pessoa." />
          </Secao>

          <Secao titulo="Funcionário pode fazer">
            <Cartao>
              <Apoio>Admin e dono continuam podendo tudo. Aqui você libera só o balcão nesta campanha.</Apoio>
              <Interruptor titulo="Disponibilizar / ativar" valor={funcionarioPodePublicar} onChange={setFuncionarioPodePublicar} />
              <Interruptor titulo="Pausar" valor={funcionarioPodePausar} onChange={setFuncionarioPodePausar} />
              <Interruptor titulo="Encerrar" valor={funcionarioPodeEncerrar} onChange={setFuncionarioPodeEncerrar} />
              {!isCartao ? <Interruptor titulo="Sortear" valor={funcionarioPodeSortear} onChange={setFuncionarioPodeSortear} /> : null}
            </Cartao>
          </Secao>
        </>
      )}

      <Cartao destaque>
        <Texto>{resumoNovaCampanha({ tipo, selosNecessarios, valorPorCupom, quantidadeGanhadores, limiteTotalCupons, valorMinimoCompra, premio })}</Texto>
      </Cartao>
      <View style={estilos.acoesLinha}>
        <Botao titulo="Salvar rascunho" variante="secundario" carregando={criar.isPending} onPress={() => salvar(false)} />
        <Botao titulo="Disponibilizar" carregando={criar.isPending} onPress={() => salvar(true)} />
      </View>
    </Folha>
  );
}

function dataInput(diasAgora: number) {
  const d = new Date();
  d.setDate(d.getDate() + diasAgora);
  return d.toISOString().slice(0, 10);
}

function dataFormulario(valor: string, tipo: "inicio" | "fim" | "sorteio") {
  const sufixo = tipo === "fim" ? "T23:59:59" : tipo === "sorteio" ? "T19:00:00" : "T00:00:00";
  const d = new Date(`${valor.trim()}${sufixo}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDaData(valor: Date, tipo: "inicio" | "fim" | "sorteio") {
  const base = valor.toISOString().slice(0, 10);
  return dataFormulario(base, tipo)?.toISOString() ?? paraIso(valor);
}

function inteiroCampo(valor: string) {
  const numero = Number(valor.replace(/\D/g, ""));
  return Number.isFinite(numero) ? numero : null;
}

function resumoNovaCampanha({
  tipo,
  selosNecessarios,
  valorPorCupom,
  quantidadeGanhadores,
  limiteTotalCupons,
  valorMinimoCompra,
  premio,
}: {
  tipo: TipoCampanha;
  selosNecessarios: string;
  valorPorCupom: number | null;
  quantidadeGanhadores: string;
  limiteTotalCupons: string;
  valorMinimoCompra: number | null;
  premio: string;
}) {
  if (tipo === "CARTAO_FIDELIDADE") {
    const minimo = valorMinimoCompra ? ` de ${moeda(valorMinimoCompra)} ou mais` : "";
    return `Cada compra${minimo} dá 1 selo. Com ${inteiroCampo(selosNecessarios) ?? 10} selos, o cliente ganha ${premio.trim() || "o prêmio"}.`;
  }
  const ganhadores = inteiroCampo(quantidadeGanhadores) ?? 1;
  const limite = inteiroCampo(limiteTotalCupons);
  return `A cada ${moeda(valorPorCupom ?? 0)}, 1 cupom. No fim, ${plural(ganhadores, "ganhador leva", "ganhadores levam")} ${premio.trim() || "o prêmio"}.${limite ? ` Limite de ${limite} cupons.` : ""}`;
}

function FormularioEntrega({ entrega, onFechar }: { entrega: Entrega | null; onFechar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [documentoConferido, setDocumentoConferido] = useState("");
  const [entregarParaTerceiro, setEntregarParaTerceiro] = useState(false);
  const [recebedorNome, setRecebedorNome] = useState("");
  const [recebedorDocumento, setRecebedorDocumento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [scannerAberto, setScannerAberto] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const entregar = useEntregar();

  useEffect(() => {
    if (!entrega) return;
    setCodigo("");
    setDocumentoConferido("");
    setEntregarParaTerceiro(false);
    setRecebedorNome("");
    setRecebedorDocumento("");
    setObservacao("");
    setScannerAberto(false);
  }, [entrega]);

  const abrirScanner = async () => {
    if (!permission?.granted) {
      const resposta = await requestPermission();
      if (!resposta.granted) {
        avisar.erro("Permita o uso da câmera para ler o QR Code.");
        return;
      }
    }
    setScannerAberto(true);
  };

  return (
    <>
      <Folha visivel={Boolean(entrega) && !scannerAberto} titulo="Confirmar entrega" onFechar={onFechar} grande>
        <Cartao style={{ gap: spacing.sm }}>
          <Titulo nivel={3}>{entrega?.premio}</Titulo>
          <Apoio>{entrega?.campanha}</Apoio>
          <Divisor />
          <Linha rotulo="Cliente">{entrega?.cliente}</Linha>
          <Linha rotulo="Telefone">{entrega?.telefoneCliente ? telefone(entrega.telefoneCliente) : ""}</Linha>
        </Cartao>
        {entrega?.instrucoesRetirada ? (
          <Cartao style={{ gap: spacing.xs }}>
            <Rotulo>Como retirar</Rotulo>
            <Texto>{entrega.instrucoesRetirada}</Texto>
          </Cartao>
        ) : null}
        <Campo rotulo="Código do prêmio" valor={codigo} onChange={setCodigo} placeholder={entrega?.codigo} autoCapitalize="characters" />
        <Cartao style={{ gap: spacing.sm }}>
          <Rotulo>Conferir cliente</Rotulo>
          <Apoio>Leia o QR do cliente ou digite CPF/código do cartão.</Apoio>
          <Botao titulo="Ler QR do cliente" icone="qr-code-outline" variante="secundario" largura="cheia" onPress={abrirScanner} />
          <Campo rotulo="CPF ou QR/código" valor={documentoConferido} onChange={setDocumentoConferido} placeholder="CPF ou FID-000000" autoCapitalize="characters" />
        </Cartao>
        <Interruptor
          titulo="Entregar para outra pessoa"
          descricao="Use quando quem retirou não é o titular do prêmio."
          valor={entregarParaTerceiro}
          onChange={setEntregarParaTerceiro}
        />
        {entregarParaTerceiro ? (
          <Cartao style={{ gap: spacing.sm }}>
            <Campo rotulo="Nome de quem retirou" valor={recebedorNome} onChange={setRecebedorNome} placeholder="Nome completo" />
            <Campo rotulo="CPF/documento de quem retirou" valor={recebedorDocumento} onChange={setRecebedorDocumento} placeholder="Opcional, mas recomendado" teclado="numeric" />
          </Cartao>
        ) : null}
        <Campo rotulo="Observação" valor={observacao} onChange={setObservacao} multilinha />
        <Botao titulo="Confirmar entrega" icone="checkmark" largura="cheia" carregando={entregar.isPending} onPress={() => {
          if (!entrega) return;
          if (entregarParaTerceiro && !recebedorNome.trim()) return avisar.erro("Informe quem retirou o prêmio.");
          if (!codigo.trim() && !documentoConferido.trim() && !entregarParaTerceiro) return avisar.erro("Leia o QR, digite o CPF ou informe o código do prêmio.");
          entregar.mutate({
            id: entrega.id,
            codigo: codigo.trim() || undefined,
            documentoConferido: documentoConferido.trim() || undefined,
            entregarParaTerceiro,
            recebedorNome: recebedorNome.trim() || undefined,
            recebedorDocumento: recebedorDocumento.trim() || undefined,
            observacao: observacao.trim() || undefined,
          }, { onSuccess: onFechar });
        }} />
      </Folha>
      <ScannerQrCliente
        visivel={scannerAberto}
        onFechar={() => setScannerAberto(false)}
        onLer={(valor) => {
          setDocumentoConferido(textoBuscaDoQr(valor));
          setScannerAberto(false);
          avisar.informacao("QR lido. Confira antes de confirmar a entrega.");
        }}
      />
    </>
  );
}

function FormularioCancelarEntrega({ entrega, onFechar }: { entrega: Entrega | null; onFechar: () => void }) {
  const [observacao, setObservacao] = useState("");
  const cancelar = useCancelarEntrega();
  return (
    <Folha visivel={Boolean(entrega)} titulo="Cancelar entrega" onFechar={onFechar}>
      <Campo rotulo="Motivo" valor={observacao} onChange={setObservacao} multilinha />
      <Botao titulo="Cancelar entrega" variante="perigo" largura="cheia" carregando={cancelar.isPending} onPress={() => {
        if (!entrega) return;
        cancelar.mutate({ id: entrega.id, observacao }, { onSuccess: onFechar });
      }} />
    </Folha>
  );
}

function FormularioMembro({ perfil, visivel, onFechar }: { perfil: Perfil; visivel: boolean; onFechar: () => void }) {
  const opcoesPerfil = perfisAtribuiveis({ perfil });
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [fone, setFone] = useState("");
  const [perfilNovo, setPerfilNovo] = useState<"ADMINISTRADOR" | "FUNCIONARIO">(opcoesPerfil[0] ?? "FUNCIONARIO");
  const criar = useCriarMembro(() => {
    setNome(""); setEmail(""); setFone(""); onFechar();
  });
  return (
    <Folha visivel={visivel} titulo="Novo membro" onFechar={onFechar}>
      <Campo rotulo="Nome" valor={nome} onChange={setNome} />
      <Campo rotulo="E-mail" valor={email} onChange={setEmail} teclado="email-address" autoCapitalize="none" />
      <Campo rotulo="Telefone" valor={fone} onChange={setFone} teclado="phone-pad" />
      <Seletor rotulo="Perfil" valor={perfilNovo} onChange={setPerfilNovo} opcoes={opcoesPerfil.map((valor) => ({ valor, rotulo: ROTULO_PERFIL[valor] }))} />
      <Botao titulo="Cadastrar membro" largura="cheia" carregando={criar.isPending} onPress={() => criar.mutate({ nome, email, telefone: fone || undefined, perfil: perfilNovo })} />
    </Folha>
  );
}

function FormularioEmpresa({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [doc, setDoc] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const criar = useCriarEmpresa(() => {
    setNomeFantasia(""); setRazaoSocial(""); setDoc(""); setCidade(""); setUf(""); onFechar();
  });
  return (
    <Folha visivel={visivel} titulo="Nova empresa" onFechar={onFechar}>
      <Campo rotulo="Nome fantasia" valor={nomeFantasia} onChange={setNomeFantasia} />
      <Campo rotulo="Razão social" valor={razaoSocial} onChange={setRazaoSocial} />
      {/*
        CPF ou CNPJ: a barraca de açaí e o lava-jato costumam não ter inscrição
        própria e são cadastrados no documento do dono.
      */}
      <Campo rotulo="CPF ou CNPJ" valor={doc} onChange={setDoc} teclado="numeric" placeholder="Somente números" />
      <Campo rotulo="Cidade" valor={cidade} onChange={setCidade} />
      <Campo rotulo="UF" valor={uf} onChange={setUf} maxLength={2} autoCapitalize="characters" />
      <Botao titulo="Cadastrar empresa" largura="cheia" carregando={criar.isPending} onPress={() => criar.mutate({ nomeFantasia, razaoSocial, documento: doc, cidade, uf })} />
    </Folha>
  );
}

function FormularioEditarEmpresa({ empresa, onFechar }: { empresa: Empresa | null; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [cidadeValor, setCidadeValor] = useState("");
  const [ufValor, setUfValor] = useState("");
  const [situacao, setSituacao] = useState<"ATIVA" | "INATIVA">("ATIVA");
  const editar = useEditarEmpresa(onFechar);
  useEffect(() => {
    if (!empresa) return;
    setNome(empresa.nomeFantasia);
    setCidadeValor(empresa.cidade ?? "");
    setUfValor(empresa.uf ?? "");
    setSituacao(empresa.situacao);
  }, [empresa]);
  return (
    <Folha visivel={Boolean(empresa)} titulo="Editar empresa" onFechar={onFechar}>
      <Campo rotulo="Nome fantasia" valor={nome} onChange={setNome} />
      <Campo rotulo="Cidade" valor={cidadeValor} onChange={setCidadeValor} />
      <Campo rotulo="UF" valor={ufValor} onChange={setUfValor} maxLength={2} autoCapitalize="characters" />
      <Seletor rotulo="Situação" valor={situacao} onChange={setSituacao} opcoes={[{ valor: "ATIVA", rotulo: "Ativa" }, { valor: "INATIVA", rotulo: "Inativa" }]} />
      <Botao titulo="Salvar empresa" largura="cheia" carregando={editar.isPending} onPress={() => empresa && editar.mutate({ id: empresa.id, nomeFantasia: nome, cidade: cidadeValor, uf: ufValor, situacao })} />
    </Folha>
  );
}

function ConfiguracoesCard() {
  const query = useConfiguracao();
  const salvar = useSalvarConfiguracao();
  const [valor, setValor] = useState<Configuracao | null>(null);
  useEffect(() => {
    if (query.data) setValor(query.data);
  }, [query.data]);
  if (query.isLoading || !valor) return <CarregandoBloco />;
  if (query.isError) return <ErroBloco />;
  return (
    <Cartao>
      <Titulo nivel={3}>Configurações da loja</Titulo>
      <Interruptor titulo="Avisar cliente" valor={valor.avisarCliente} onChange={(v) => setValor({ ...valor, avisarCliente: v })} />
      <Interruptor
        titulo="Mandar o aviso por WhatsApp"
        descricao="O aviso vai para o WhatsApp do cliente, no número do cadastro. Desligado, ele continua aparecendo na consulta do cartão."
        valor={Boolean(valor.avisarWhatsapp) && valor.avisarCliente}
        onChange={(v) => setValor({ ...valor, avisarWhatsapp: v })}
      />
      {valor.avisarCliente ? <ConexaoWhatsApp /> : null}
      <Interruptor titulo="Bloquear próprio CPF" valor={valor.bloquearProprioCpf} onChange={(v) => setValor({ ...valor, bloquearProprioCpf: v })} />
      <Interruptor titulo="Bloquear duplicados" valor={valor.bloquearDuplicados} onChange={(v) => setValor({ ...valor, bloquearDuplicados: v })} />
      <Interruptor
        titulo="Exigir código depois do rosto"
        descricao="Desative para o cliente abrir o cartão somente com reconhecimento facial."
        valor={Boolean(valor.rostoExigeCodigo)}
        onChange={(v) => setValor({ ...valor, rostoExigeCodigo: v })}
      />
      <Botao titulo="Salvar" carregando={salvar.isPending} onPress={() => salvar.mutate(valor)} />
    </Cartao>
  );
}

/**
 * O número de WhatsApp está conectado?
 *
 * Existe porque a falha aqui é silenciosa: a instância desconecta do celular e,
 * a partir dali, toda mensagem é recusada sem que nada apareça na tela. Sem esta
 * linha, a loja descobre semanas depois, por um cliente reclamando.
 *
 * Erro na consulta não vira bloco de erro: as chaves acima continuam utilizáveis
 * sem esta informação, e uma tela de erro no meio delas sugeriria que pararam.
 */
function ConexaoWhatsApp() {
  const query = useEstadoWhatsApp();
  const estado = query.data;

  const ok = Boolean(estado?.configurado && estado.conectado && estado.celularConectado);
  const tom: Tone = query.isLoading || query.isError || !estado ? "neutral" : ok ? "success" : "warning";

  const texto = (() => {
    if (query.isLoading) return "Verificando o número…";
    if (query.isError || !estado) return "Não foi possível verificar o número agora.";
    if (!estado.configurado) return "Sem número configurado — as mensagens não saem.";
    if (!estado.conectado) return `Número desconectado. ${estado.detalhe}`;
    if (!estado.celularConectado) {
      return "Número conectado, mas o celular está sem internet: as mensagens ficam paradas.";
    }
    return "Número conectado e enviando.";
  })();

  return (
    <View style={{ gap: spacing.xs }}>
      <Selo tom={tom}>{ok ? "WhatsApp conectado" : "WhatsApp"}</Selo>
      <Apoio>{texto}</Apoio>
      <Botao
        titulo={query.isFetching ? "Verificando…" : "Verificar agora"}
        variante="secundario"
        carregando={query.isFetching}
        onPress={() => query.refetch()}
      />
    </View>
  );
}

function AuthLayout({ subtitulo, voltar, children }: { subtitulo: string; voltar?: () => void; children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.safe}>
      <ScrollView contentContainerStyle={estilos.auth}>
        {voltar ? <BotaoIcone icone="arrow-back" rotulo="Voltar" onPress={voltar} /> : null}
        <View style={estilos.authMarca}>
          <LogoMarca grande />
          <Apoio style={{ textAlign: "center" }}>{subtitulo}</Apoio>
        </View>
        <Cartao style={{ gap: spacing.md }}>{children}</Cartao>
      </ScrollView>
    </SafeAreaView>
  );
}

function Folha({ visivel, titulo, onFechar, children, grande = false }: { visivel: boolean; titulo: string; onFechar: () => void; children: ReactNode; grande?: boolean }) {
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar} statusBarTranslucent>
      <View style={estilos.fundoFolha}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} accessibilityLabel="Fechar" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={estilos.ancoraFolha}>
          <View style={[estilos.folha, grande && estilos.folhaGrande]}>
          <View style={estilos.linhaEntre}>
            <Titulo nivel={2}>{titulo}</Titulo>
            <BotaoIcone icone="close" rotulo="Fechar" onPress={onFechar} />
          </View>
          <ScrollView contentContainerStyle={estilos.conteudoFolha} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Toasts() {
  const avisos = useAvisos((estado) => estado.fila);
  if (!avisos.length) return null;
  return (
    <View pointerEvents="none" style={estilos.toasts}>
      {avisos.map((aviso) => {
        const tom: Tone = aviso.tipo === "erro" ? "danger" : aviso.tipo === "sucesso" ? "success" : "info";
        const cor = toneColors[tom];
        return (
          <View key={aviso.id} style={[estilos.toast, { backgroundColor: cor.background, borderColor: cor.border }]}>
            <Text style={{ color: cor.foreground, fontWeight: fontWeight.semibold }}>{aviso.texto}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TopoSimples({ titulo, subtitulo, acao }: { titulo: string; subtitulo: string; acao?: ReactNode }) {
  return (
    <View style={estilos.linhaEntre}>
      <View style={{ flex: 1 }}>
        <Titulo>{titulo}</Titulo>
        <Apoio>{subtitulo}</Apoio>
      </View>
      {acao}
    </View>
  );
}

function Atalho({ icone, titulo, onPress }: { icone: React.ComponentProps<typeof Ionicons>["name"]; titulo: string; onPress: () => void }) {
  return (
    <Pressable style={estilos.atalho} onPress={onPress}>
      <View style={estilos.atalhoIcone}><Icone nome={icone} cor={colors.primaryForeground} tamanho={22} /></View>
      <Text numberOfLines={1} style={estilos.atalhoTexto}>{titulo}</Text>
    </Pressable>
  );
}

function Indicador({ titulo, valor, icone, detalhe }: { titulo: string; valor: string; icone: React.ComponentProps<typeof Ionicons>["name"]; detalhe?: string }) {
  return (
    <Cartao style={{ flex: 1 }}>
      <Icone nome={icone} cor={colors.primary} />
      <Numero>{valor}</Numero>
      <Apoio>{titulo}</Apoio>
      {detalhe ? <Apoio>{detalhe}</Apoio> : null}
    </Cartao>
  );
}

function GraficoMovimento({ pontos }: { pontos: Array<{ dia: string; valor: number }> }) {
  const maximo = Math.max(...pontos.map((ponto) => ponto.valor), 0);
  if (!pontos.length || maximo === 0) return <Vazio texto="Nenhuma compra registrada neste período." />;

  const passo = pontos.length > 14 ? Math.ceil(pontos.length / 6) : 1;
  const total = pontos.reduce((soma, ponto) => soma + ponto.valor, 0);
  const diasComMovimento = pontos.filter((ponto) => ponto.valor > 0).length;
  const media = diasComMovimento ? Math.round(total / diasComMovimento) : 0;
  const melhorDia = pontos.reduce((melhor, ponto) => (ponto.valor > melhor.valor ? ponto : melhor), pontos[0]);
  const alturaMedia = Math.max(6, Math.round((media / maximo) * 112));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={estilos.graficoResumo}>
        <MiniDado rotulo="Total" valor={moeda(total)} />
        <MiniDado rotulo="Média/dia" valor={moeda(media)} />
        <MiniDado rotulo="Dias ativos" valor={`${diasComMovimento}/${pontos.length}`} />
        <MiniDado rotulo="Melhor dia" valor={`${diaMes(melhorDia.dia)} · ${moeda(melhorDia.valor)}`} />
      </View>
      <View style={estilos.grafico}>
        <View pointerEvents="none" style={estilos.graficoEscala}>
          <Apoio style={estilos.graficoEscalaTexto}>{moeda(maximo)}</Apoio>
          <Apoio style={estilos.graficoEscalaTexto}>{moeda(Math.round(maximo / 2))}</Apoio>
          <Apoio style={estilos.graficoEscalaTexto}>R$ 0</Apoio>
        </View>
        <View style={estilos.graficoPlot}>
          <View style={estilos.graficoBarras}>
            {pontos.map((ponto, indice) => {
              const altura = Math.max(6, Math.round((ponto.valor / maximo) * 112));
              const mostrarRotulo = indice % passo === 0 || indice === pontos.length - 1;
              const destaque = ponto.dia === melhorDia.dia;
              return (
                <View key={ponto.dia} style={estilos.graficoColuna}>
                  <Apoio numberOfLines={1} style={estilos.graficoValor}>{ponto.valor > 0 ? moeda(ponto.valor) : ""}</Apoio>
                  <View style={[estilos.graficoBarra, destaque && estilos.graficoBarraDestaque, { height: altura }]} />
                  <Apoio style={estilos.graficoRotulo}>{mostrarRotulo ? diaMes(ponto.dia) : ""}</Apoio>
                </View>
              );
            })}
          </View>
          <View pointerEvents="none" style={estilos.graficoGrade}>
            <View style={estilos.graficoLinhaGrade} />
            <View style={estilos.graficoLinhaGrade} />
            <View style={estilos.graficoLinhaGrade} />
          </View>
          <View pointerEvents="none" style={[estilos.graficoLinhaMedia, { bottom: 26 + alturaMedia }]} />
        </View>
      </View>
      <Apoio>Linha verde: média dos dias com movimento. Barra escura: melhor dia.</Apoio>
    </View>
  );
}

function MiniDado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={estilos.miniDado}>
      <Apoio>{rotulo}</Apoio>
      <Texto numberOfLines={1} style={{ fontWeight: fontWeight.semibold }}>{valor}</Texto>
    </View>
  );
}

function LinhaAcao({ icone, titulo, subtitulo, tom, onPress }: { icone: React.ComponentProps<typeof Ionicons>["name"]; titulo: string; subtitulo: string; tom: Tone; onPress?: () => void }) {
  const cor = toneColors[tom];
  const conteudo = (
    <Cartao destaque={tom === "warning" || tom === "brand"}>
      <View style={estilos.linhaComIcone}>
        <View style={[estilos.iconeLinha, { backgroundColor: cor.background, borderColor: cor.border }]}>
          <Icone nome={icone} cor={cor.foreground} tamanho={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontWeight: fontWeight.semibold }}>{titulo}</Texto>
          <Apoio>{subtitulo}</Apoio>
        </View>
        {onPress ? <Icone nome="chevron-forward" /> : null}
      </View>
    </Cartao>
  );

  if (!onPress) return conteudo;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={titulo}>
      {conteudo}
    </Pressable>
  );
}

function LogoMarca({ grande = false }: { grande?: boolean }) {
  return (
    <View style={estilos.logoMarca}>
      <Image
        source={LOGO}
        resizeMode="contain"
        style={grande ? estilos.logoImagemGrande : estilos.logoImagem}
      />
    </View>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <View style={estilos.vazio}>
      <Icone nome="file-tray-outline" cor={colors.muted} tamanho={24} />
      <Apoio>{texto}</Apoio>
    </View>
  );
}

function ErroBloco() {
  return (
    <View style={estilos.vazio}>
      <Icone nome="cloud-offline-outline" cor={colors.danger} tamanho={24} />
      <Apoio>Não foi possível carregar. Confira a API e tente novamente.</Apoio>
    </View>
  );
}

function CarregandoBloco() {
  return (
    <View style={estilos.vazio}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function CarregandoTela() {
  return (
    <SafeAreaView style={estilos.safe}>
      <View style={estilos.carregandoTela}>
        <LogoMarca grande />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
}

function tomCampanha(situacao: Campanha["situacao"]): Tone {
  if (situacao === "ATIVA") return "success";
  if (situacao === "RASCUNHO") return "neutral";
  if (situacao === "PAUSADA") return "warning";
  if (situacao === "ENCERRADA") return "info";
  return "brand";
}

function tomEntrega(situacao: Entrega["situacao"]): Tone {
  if (situacao === "AGUARDANDO") return "warning";
  if (situacao === "ENTREGUE") return "success";
  return "danger";
}

/*
 * Folha por esquema, e não uma só criada na importação: `StyleSheet.create`
 * congela as cores no instante em que roda, e no topo do módulo isso é uma vez
 * só, com o tema que estava valendo. Ver `folhaTematica`.
 */
const estilos = folhaTematica(() => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  auth: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  authMarca: {
    alignItems: "center",
    gap: spacing.sm,
  },
  logoMarca: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImagem: {
    width: 96,
    height: 44,
  },
  logoImagemGrande: {
    width: 150,
    height: 70,
  },
  divisorComTexto: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  linha: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  cabecalho: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: borderWidth.hairline,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marcaLinha: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tituloTela: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  miolo: {
    flex: 1,
  },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  conteudoComNav: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 112,
  },
  telaLista: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  listaComNav: {
    gap: spacing.md,
    paddingBottom: 112,
  },
  filtroResumo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  painelFiltros: {
    padding: spacing.md,
    gap: spacing.md,
  },
  campanhaCard: {
    gap: spacing.md,
    overflow: "hidden",
  },
  campanhaTopo: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  campanhaIcone: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: borderWidth.hairline,
    borderColor: colors.heading,
  },
  limiteCuponsCard: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accent,
    borderWidth: borderWidth.hairline,
    borderColor: colors.primary,
  },
  campanhaFaixa: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.accent,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  campanhaProgressoFundo: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  campanhaProgressoBarra: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  navbar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    height: 70,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: spacing.sm,
    shadowColor: colors.heading,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
    overflow: "hidden",
  },
  fabCompra: {
    position: "absolute",
    right: spacing.xl,
    bottom: 92,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borderWidth.hairline,
    borderColor: colors.heading,
    shadowColor: colors.heading,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navItemAtivo: {
    backgroundColor: colors.accent,
    borderRadius: 22,
  },
  navMarcaAtiva: {
    position: "absolute",
    top: 0,
    width: 22,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  navTexto: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  navTextoAtivo: {
    color: colors.heading,
    fontWeight: fontWeight.bold,
  },
  fundoFolha: {
    flex: 1,
    backgroundColor: "rgba(8, 41, 29, 0.42)",
    justifyContent: "flex-end",
  },
  ancoraFolha: {
    justifyContent: "flex-end",
  },
  folha: {
    maxHeight: "86%",
    backgroundColor: colors.surface,
    borderTopWidth: 3,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  folhaGrande: {
    maxHeight: "95%",
  },
  conteudoFolha: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  scannerHeader: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: borderWidth.hairline,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  camera: {
    flex: 1,
  },
  miraQr: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 41, 29, 0.18)",
  },
  miraCaixa: {
    width: 230,
    height: 230,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: "transparent",
  },
  itemMenuCompleto: {
    minHeight: theme.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemSelecionado: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  cartaoPrincipal: {
    minHeight: 162,
    backgroundColor: colors.primary,
    borderLeftWidth: 5,
    borderLeftColor: colors.heading,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  numeroPrincipal: {
    color: colors.primaryForeground,
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontVariant: ["tabular-nums"],
  },
  iconePrincipal: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: borderWidth.hairline,
    borderColor: "rgba(255,255,255,0.36)",
  },
  atalhos: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  atalho: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  atalhoIcone: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  atalhoTexto: {
    color: colors.heading,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  gradeIndicadores: {
    flexDirection: "row",
    gap: spacing.md,
  },
  linhaEntre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  topoDetalhe: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  linhaComIcone: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  acoesLinha: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  miniDado: {
    flex: 1,
    minWidth: "46%",
    gap: 2,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  graficoResumo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  grafico: {
    minHeight: 170,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  graficoPlot: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    overflow: "hidden",
  },
  graficoGrade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 18,
    bottom: 26,
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
    paddingTop: 18,
    paddingBottom: 26,
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
  graficoBarras: {
    minHeight: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  graficoColuna: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  graficoValor: {
    display: "none",
  },
  graficoBarra: {
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  graficoBarraDestaque: {
    backgroundColor: colors.heading,
  },
  graficoRotulo: {
    minHeight: 16,
    fontSize: 9,
    textAlign: "center",
  },
  iconeLinha: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borderWidth.hairline,
  },
  vazio: {
    minHeight: 74,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  carregandoTela: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  cartaoCliente: {
    minHeight: 196,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.xl,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative",
    borderWidth: borderWidth.hairline,
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
    borderWidth: borderWidth.hairline,
    borderColor: "rgba(255,255,255,0.24)",
  },
  cartaoClienteCirculoMenor: {
    position: "absolute",
    top: 82,
    right: 60,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: borderWidth.hairline,
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
    fontSize: fontSize.xl,
  },
  cartaoClienteApoio: {
    color: colors.primaryForeground,
    opacity: 0.72,
  },
  cartaoClienteRodape: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  codigoCartao: {
    color: colors.primaryForeground,
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
  },
  qrLocal: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: borderWidth.hairline,
    borderColor: "rgba(255,255,255,0.85)",
  },
  acoesTopoPortal: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sininho: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    position: "relative",
  },
  sininhoBadge: {
    position: "absolute",
    right: 5,
    top: 5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  sininhoBadgeTexto: {
    color: colors.primaryForeground,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  notificacaoPortal: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  notificacaoPortalNova: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  notificacaoPortalIcone: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  toasts: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    top: spacing.xl,
    gap: spacing.sm,
  },
  toast: {
    borderWidth: borderWidth.hairline,
    padding: spacing.md,
  },
}));
