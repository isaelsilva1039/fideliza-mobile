import { Ionicons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar, Apoio, Cartao, Icone, Linha, Numero, Rotulo, Secao, Selo, Selos, Texto, Titulo } from "./src/components/ui/base";
import { Botao, BotaoIcone } from "./src/components/ui/Botao";
import { Busca, Campo, CampoMoeda, Filtros, Interruptor, Seletor } from "./src/components/ui/formulario";
import { pode, perfisAtribuiveis } from "./src/constants/permissoes";
import {
  useAlterarSituacaoCampanha,
  useAuditoria,
  useCampanhas,
  useCancelarEntrega,
  useClientes,
  useConfiguracao,
  useCriarCampanha,
  useCriarCliente,
  useCriarEmpresa,
  useCriarMembro,
  useEditarEmpresa,
  useEntregar,
  useEntregas,
  useEquipe,
  useInicio,
  useRegistrarCompra,
  useSalvarConfiguracao,
  useSortear,
  useTodasEmpresas,
} from "./src/hooks/use-queries";
import { mensagemDoErro } from "./src/lib/api/errors";
import { data, dataHora, desde, documento, moeda, paraIso, telefone } from "./src/lib/format";
import { MENU, TITULOS, type NomeDeAba } from "./src/navigation/rotas";
import * as servico from "./src/services";
import {
  ROTULO_PERFIL,
  ROTULO_SITUACAO_CAMPANHA,
  ROTULO_SITUACAO_ENTREGA,
  ROTULO_TIPO_CAMPANHA,
  type Campanha,
  type CartaoDoPortal,
  type Cliente,
  type Configuracao,
  type Entrega,
  type Empresa,
  type Membro,
  type Perfil,
  type SituacaoCampanha,
  type SituacaoEntrega,
  type TipoCampanha,
} from "./src/services/contrato";
import { avisar, useAvisos } from "./src/stores/avisos";
import { useSession } from "./src/stores/session";
import { borderWidth, colors, fontSize, fontWeight, radius, spacing, theme, toneColors, type Tone } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
    },
  },
});

type FluxoPublico = "login" | "portal-documento" | "portal-codigo" | "portal-cartao";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FidelizaApp />
      <Toasts />
    </QueryClientProvider>
  );
}

function FidelizaApp() {
  const { session, hydrated, hydrate, setSession, clear, setEmpresaAtiva } = useSession();
  const [fluxoPublico, setFluxoPublico] = useState<FluxoPublico>("login");
  const [aba, setAba] = useState<NomeDeAba>("inicio");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!session) return;
    const primeiraAba = abasDoPerfil(session.usuario.perfil)[0]?.rota ?? "inicio";
    setAba((atual) => (abasDoPerfil(session.usuario.perfil).some((item) => item.rota === atual) ? atual : primeiraAba));
  }, [session]);

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
      onAba={setAba}
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
      {aba === "inicio" ? <Inicio perfil={session.usuario.perfil} onAba={setAba} /> : null}
      {aba === "campanhas" ? <Campanhas podeGerenciar={pode(session.usuario, "campanhas.gerenciar")} podeSortear={pode(session.usuario, "campanhas.sortear")} /> : null}
      {aba === "clientes" ? <Clientes podeGerenciar={pode(session.usuario, "clientes.gerenciar")} /> : null}
      {aba === "entregas" ? <Entregas /> : null}
      {aba === "lancamentos" ? <Lancamentos /> : null}
      {aba === "equipe" ? <Equipe perfil={session.usuario.perfil} /> : null}
      {aba === "empresas" ? <Empresas /> : null}
    </Shell>
  );
}

function abasDoPerfil(perfil: Perfil) {
  return MENU.filter((item) => !item.permissao || pode({ perfil }, item.permissao));
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

  async function pedirCodigo() {
    if (!documentoValor) return avisar.erro("Informe o documento.");
    setCarregando(true);
    try {
      const pedido = await servico.pedirCodigo(documentoValor);
      setPedidoId(pedido.pedidoId);
      setTelefoneFinal(pedido.finalDoTelefone);
      onFluxo("portal-codigo");
      if (pedido.codigoDemonstracao) Alert.alert("Código de demonstração", pedido.codigoDemonstracao);
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

  if (fluxo === "portal-documento") {
    return (
      <AuthLayout subtitulo="Consulte cartões, cupons e prêmios." voltar={() => onFluxo("login")}>
        <Campo rotulo="CPF ou CNPJ" valor={documentoValor} onChange={setDocumentoValor} teclado="numeric" placeholder="Somente números" />
        <Botao titulo="Receber código" icone="chatbubble-ellipses-outline" largura="cheia" carregando={carregando} onPress={() => void pedirCodigo()} />
      </AuthLayout>
    );
  }

  if (fluxo === "portal-codigo") {
    return (
      <AuthLayout subtitulo={`Código enviado para ${telefoneFinal}.`} voltar={() => onFluxo("portal-documento")}>
        <Campo rotulo="Código" valor={codigo} onChange={setCodigo} teclado="numeric" placeholder="000000" />
        <Botao titulo="Abrir meu cartão" icone="card-outline" largura="cheia" carregando={carregando} onPress={() => void abrirCartao()} />
      </AuthLayout>
    );
  }

  return <CartaoPublico cartao={cartao} onSair={() => onFluxo("login")} />;
}

function CartaoPublico({ cartao, onSair }: { cartao?: CartaoDoPortal; onSair: () => void }) {
  return (
    <SafeAreaView style={estilos.safe}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <TopoSimples titulo={`Olá${cartao?.primeiroNome ? `, ${cartao.primeiroNome}` : ""}`} subtitulo={cartao?.empresa ?? "Seus benefícios"} acao={<Botao titulo="Sair" variante="sutil" compacto onPress={onSair} />} />
        <View style={estilos.cartaoCliente}>
          <View style={estilos.cartaoClienteTopo}>
            <Rotulo style={{ color: colors.primaryForeground }}>Meu cartão</Rotulo>
            <Icone nome="card" cor={colors.primaryForeground} tamanho={24} />
          </View>
          <Text style={estilos.codigoCartao}>{cartao?.codigoCartao ?? ""}</Text>
          <Apoio style={{ color: colors.primaryForeground }}>Fidelidade que volta para você</Apoio>
        </View>
        <Secao titulo="Cartões">
          {cartao?.cartoes.length ? cartao.cartoes.map((item) => (
            <Cartao key={`${item.empresa}-${item.campanhaId}`}>
              <Titulo nivel={3}>{item.campanha}</Titulo>
              <Apoio>{item.empresa} • {item.premio}</Apoio>
              <Selos atuais={item.selosAtuais} necessarios={item.selosNecessarios} />
              <Linha rotulo="Termina em">{data(item.terminaEm)}</Linha>
            </Cartao>
          )) : <Vazio texto="Nenhum cartão ativo no momento." />}
        </Secao>
        <Secao titulo="Sorteios">
          {cartao?.sorteios.length ? cartao.sorteios.map((item) => (
            <Cartao key={`${item.empresa}-${item.campanhaId}`}>
              <Linha rotulo={item.campanha}><Selo tom={item.ganhou ? "success" : item.sorteado ? "neutral" : "brand"}>{item.ganhou ? "Ganhou" : item.sorteado ? "Sorteado" : "Concorrendo"}</Selo></Linha>
              <Texto>{item.cupons} cupons • {item.premio}</Texto>
              <Apoio>{item.empresa}</Apoio>
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
  aba: NomeDeAba;
  abas: ReturnType<typeof abasDoPerfil>;
  usuario: string;
  perfil: Perfil;
  empresa: string;
  empresas: Empresa[];
  empresaAtivaId: string;
  onTrocarEmpresa: (id: string) => void;
  onAba: (aba: NomeDeAba) => void;
  onSair: () => void;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
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
        <BotaoIcone icone="person-circle-outline" rotulo="Abrir perfil" onPress={() => setPerfilAberto(true)} />
      </View>
      <View style={estilos.tituloTela}>
        <View>
          <Rotulo>{ROTULO_PERFIL[perfil]}</Rotulo>
          <Titulo>{TITULOS[aba]}</Titulo>
        </View>
      </View>
      <View style={estilos.miolo}>{children}</View>
      <View style={estilos.navbar}>
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
    </SafeAreaView>
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
  const [dias, setDias] = useState<"7" | "30" | "90">("30");
  const [compraRapidaAberta, setCompraRapidaAberta] = useState(false);
  const query = useInicio(Number(dias));
  const inicio = query.data;

  return (
    <>
      <ScrollView contentContainerStyle={estilos.conteudoComNav}>
        <Seletor rotulo="Período" valor={dias} onChange={setDias} opcoes={[{ valor: "7", rotulo: "7 dias" }, { valor: "30", rotulo: "30 dias" }, { valor: "90", rotulo: "90 dias" }]} />
        <View style={estilos.cartaoPrincipal}>
          <View style={{ flex: 1 }}>
            <Rotulo style={{ color: colors.primaryForeground }}>Movimento</Rotulo>
            <Text style={estilos.numeroPrincipal}>{inicio ? moeda(inicio.movimento.valor) : "..."}</Text>
            <Apoio style={{ color: colors.primaryForeground }}>{inicio ? `${inicio.clientesQueCompraram.valor} clientes compraram no período` : "Carregando indicadores"}</Apoio>
          </View>
          <View style={estilos.iconePrincipal}>
            <Icone nome="wallet-outline" tamanho={28} cor={colors.primaryForeground} />
          </View>
        </View>
        <View style={estilos.atalhos}>
          <Atalho icone="cash-outline" titulo="Compra" onPress={() => setCompraRapidaAberta(true)} />
          <Atalho icone="megaphone-outline" titulo="Campanhas" onPress={() => onAba("campanhas")} />
          <Atalho icone="gift-outline" titulo="Entregas" onPress={() => onAba("entregas")} />
          {perfil === "FUNCIONARIO" ? <Atalho icone="people-outline" titulo="Clientes" onPress={() => onAba("clientes")} /> : <Atalho icone="clipboard-outline" titulo="Lançamentos" onPress={() => onAba("lancamentos")} />}
        </View>
        <View style={estilos.gradeIndicadores}>
          <Indicador titulo="Campanhas no ar" valor={String(inicio?.campanhasNoAr ?? "...")} icone="radio-outline" />
          <Indicador titulo="Benefícios entregues" valor={String(inicio?.beneficiosEntregues.valor ?? "...")} icone="checkmark-done-outline" />
        </View>
        <Secao titulo="Próximas ações">
          {query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : (
            <>
              {inicio?.sorteiosProntos.slice(0, 2).map((item) => <LinhaAcao key={item.id} icone="trophy-outline" titulo={item.campanha} subtitulo={`${item.cupons} cupons • ${item.premio}`} tom="warning" onPress={() => onAba("campanhas")} />)}
              {inicio?.entregasPendentes.slice(0, 3).map((item) => <LinhaAcao key={item.id} icone="gift-outline" titulo={item.premio} subtitulo={`${item.cliente} • ${desde(item.desde)}`} tom="brand" onPress={() => onAba("entregas")} />)}
              {!inicio?.sorteiosProntos.length && !inicio?.entregasPendentes.length ? <Vazio texto="Nenhuma pendência agora." /> : null}
            </>
          )}
        </Secao>
        <Secao titulo="Últimas compras">
          {inicio?.ultimasCompras.slice(0, 5).map((item) => (
            <Cartao key={item.id}>
              <Linha rotulo={item.cliente}><Texto>{moeda(item.valor)}</Texto></Linha>
              <Apoio>{item.campanha} • {item.beneficio} • {desde(item.quando)}</Apoio>
            </Cartao>
          ))}
        </Secao>
      </ScrollView>
      <FormularioCompraRapida visivel={compraRapidaAberta} onFechar={() => setCompraRapidaAberta(false)} />
    </>
  );
}

function Campanhas({ podeGerenciar, podeSortear }: { podeGerenciar: boolean; podeSortear: boolean }) {
  const [busca, setBusca] = useState("");
  const [situacoes, setSituacoes] = useState<SituacaoCampanha[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const query = useCampanhas({ busca, situacao: situacoes, tamanho: 50 });
  const alterar = useAlterarSituacaoCampanha();
  const sortear = useSortear((sorteio) => Alert.alert("Sorteio realizado", sorteio.ganhadores.map((g) => `${g.posicao}. ${g.nome}`).join("\n") || "Sem ganhadores."));

  return (
    <View style={estilos.telaLista}>
      <BarraLista titulo="Campanhas" acao={podeGerenciar ? <Botao titulo="Nova" icone="add" compacto onPress={() => setFormAberto(true)} /> : undefined} />
      <Busca valor={busca} onChange={setBusca} placeholder="Buscar campanha" />
      <Filtros<SituacaoCampanha> selecionados={situacoes} onChange={setSituacoes} opcoes={["ATIVA", "RASCUNHO", "PAUSADA", "ENCERRADA", "SORTEADA"].map((valor) => ({ valor: valor as SituacaoCampanha, rotulo: ROTULO_SITUACAO_CAMPANHA[valor as SituacaoCampanha] }))} />
      <FlatList
        data={query.data?.content ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.listaComNav}
        ListEmptyComponent={query.isLoading ? <CarregandoBloco /> : query.isError ? <ErroBloco /> : <Vazio texto="Nenhuma campanha encontrada." />}
        renderItem={({ item }) => (
          <Cartao destaque={item.podeSortear}>
            <View style={estilos.linhaEntre}>
              <View style={{ flex: 1 }}>
                <Titulo nivel={3}>{item.nome}</Titulo>
                <Apoio>{ROTULO_TIPO_CAMPANHA[item.tipo]} • {item.regraEmUmaFrase}</Apoio>
              </View>
              <Selo tom={tomCampanha(item.situacao)}>{ROTULO_SITUACAO_CAMPANHA[item.situacao]}</Selo>
            </View>
            <View style={estilos.gradeIndicadores}>
              <MiniDado rotulo="Participantes" valor={String(item.totalParticipantes)} />
              <MiniDado rotulo="Movimento" valor={moeda(item.valorMovimentado)} />
            </View>
            <View style={estilos.acoesLinha}>
              {podeGerenciar ? item.proximasSituacoes.slice(0, 2).map((situacao) => (
                <Botao key={situacao} titulo={ROTULO_SITUACAO_CAMPANHA[situacao]} variante="secundario" compacto carregando={alterar.isPending} onPress={() => alterar.mutate({ id: item.id, situacao })} />
              )) : null}
              {podeSortear && item.podeSortear ? <Botao titulo="Sortear" icone="trophy-outline" compacto carregando={sortear.isPending} onPress={() => sortear.mutate(item.id)} /> : null}
            </View>
          </Cartao>
        )}
      />
      <FormularioCampanha visivel={formAberto} onFechar={() => setFormAberto(false)} />
    </View>
  );
}

function Clientes({ podeGerenciar }: { podeGerenciar: boolean }) {
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
            <View style={estilos.linhaEntre}>
              <View style={estilos.linhaComIcone}>
                <Avatar nome={item.nome} />
                <View style={{ flex: 1 }}>
                  <Titulo nivel={3}>{item.nome}</Titulo>
                  <Apoio>{documento(item.documento)} • {telefone(item.telefone)}</Apoio>
                </View>
              </View>
              <Selo tom={item.situacao === "ATIVO" ? "success" : "neutral"}>{item.situacao}</Selo>
            </View>
            <Linha rotulo="Cartão">{item.codigoCartao}</Linha>
            <Linha rotulo="Total gasto">{moeda(item.totalGasto)}</Linha>
            <View style={estilos.acoesLinha}>
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

function Entregas() {
  const [busca, setBusca] = useState("");
  const [situacoes, setSituacoes] = useState<SituacaoEntrega[]>(["AGUARDANDO"]);
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
                <Titulo nivel={3}>{item.premio}</Titulo>
                <Apoio>{item.cliente} • {telefone(item.telefoneCliente)}</Apoio>
              </View>
              <Selo tom={tomEntrega(item.situacao)}>{ROTULO_SITUACAO_ENTREGA[item.situacao]}</Selo>
            </View>
            <Linha rotulo="Código">{item.codigo}</Linha>
            <Linha rotulo="Campanha">{item.campanha}</Linha>
            <Apoio>{item.instrucoesRetirada ?? "Sem instrução específica"} • {desde(item.solicitadoEm)}</Apoio>
            {item.situacao === "AGUARDANDO" ? (
              <View style={estilos.acoesLinha}>
                <Botao titulo="Confirmar" icone="checkmark" compacto onPress={() => setEntregaSelecionada(item)} />
                <Botao titulo="Cancelar" variante="perigo" compacto onPress={() => setCancelarSelecionada(item)} />
              </View>
            ) : null}
          </Cartao>
        )}
      />
      <FormularioEntrega entrega={entregaSelecionada} onFechar={() => setEntregaSelecionada(null)} />
      <FormularioCancelarEntrega entrega={cancelarSelecionada} onFechar={() => setCancelarSelecionada(null)} />
    </View>
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

function FormularioCliente({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [fone, setFone] = useState("");
  const [email, setEmail] = useState("");
  const criar = useCriarCliente(() => {
    setNome(""); setDoc(""); setFone(""); setEmail(""); onFechar();
  });
  return (
    <Folha visivel={visivel} titulo="Novo cliente" onFechar={onFechar}>
      <Campo rotulo="Nome" valor={nome} onChange={setNome} />
      <Campo rotulo="CPF ou CNPJ" valor={doc} onChange={setDoc} teclado="numeric" />
      <Campo rotulo="Telefone" valor={fone} onChange={setFone} teclado="phone-pad" />
      <Campo rotulo="E-mail" valor={email} onChange={setEmail} teclado="email-address" autoCapitalize="none" />
      <Botao titulo="Cadastrar" largura="cheia" carregando={criar.isPending} onPress={() => criar.mutate({ nome, documento: doc, telefone: fone, email: email || undefined })} />
    </Folha>
  );
}

function FormularioCompra({ cliente, onFechar }: { cliente: Cliente | null; onFechar: () => void }) {
  const [campanhaId, setCampanhaId] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const campanhas = useCampanhas({ tamanho: 50 });
  const registrar = useRegistrarCompra(() => {
    setValor(null);
    setCampanhaId("");
    onFechar();
  });
  const campanhaSelecionada = campanhas.data?.content.find((item) => item.id === campanhaId);
  const opcoes = useMemo(() => (campanhas.data?.content ?? []).map((item) => ({
    valor: item.id,
    rotulo: item.nome,
    dica: `${ROTULO_SITUACAO_CAMPANHA[item.situacao]} • ${item.regraEmUmaFrase}`,
  })), [campanhas.data]);
  return (
    <Folha visivel={Boolean(cliente)} titulo={cliente ? `Compra de ${cliente.nome}` : "Registrar compra"} onFechar={onFechar}>
      {campanhas.isLoading ? <CarregandoBloco /> : campanhas.isError ? <ErroBloco /> : opcoes.length ? (
        <Seletor rotulo="Campanha" valor={campanhaId || null} onChange={setCampanhaId} opcoes={opcoes} coluna />
      ) : (
        <Vazio texto="Nenhuma campanha cadastrada. Crie e publique uma campanha antes de lançar compra." />
      )}
      <CampoMoeda rotulo="Valor da compra" centavos={valor} onChange={setValor} />
      <Botao titulo="Registrar compra" icone="cash-outline" largura="cheia" carregando={registrar.isPending} onPress={() => {
        if (!cliente || !campanhaId || !valor) return avisar.erro("Selecione campanha e informe um valor.");
        if (campanhaSelecionada?.situacao !== "ATIVA") return avisar.erro("A campanha precisa estar No ar para receber lançamento.");
        registrar.mutate({ clienteId: cliente.id, campanhaId, valorCompra: valor });
      }} />
    </Folha>
  );
}

function FormularioCompraRapida({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [campanhaId, setCampanhaId] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const clientes = useClientes({ busca: buscaCliente, tamanho: 12 });
  const campanhas = useCampanhas({ tamanho: 50 });
  const registrar = useRegistrarCompra(() => {
    setBuscaCliente("");
    setClienteId("");
    setCampanhaId("");
    setValor(null);
    onFechar();
  });
  const opcoesClientes = useMemo(
    () => (clientes.data?.content ?? []).map((item) => ({
      valor: item.id,
      rotulo: item.nome,
      dica: `${documento(item.documento)} • ${item.codigoCartao}`,
    })),
    [clientes.data],
  );
  const opcoesCampanhas = useMemo(
    () => (campanhas.data?.content ?? []).map((item) => ({
      valor: item.id,
      rotulo: item.nome,
      dica: `${ROTULO_SITUACAO_CAMPANHA[item.situacao]} • ${item.regraEmUmaFrase}`,
    })),
    [campanhas.data],
  );
  const campanhaSelecionada = campanhas.data?.content.find((item) => item.id === campanhaId);

  return (
    <Folha visivel={visivel} titulo="Registrar compra" onFechar={onFechar}>
      <Busca valor={buscaCliente} onChange={setBuscaCliente} placeholder="Buscar cliente" />
      {clientes.isLoading ? <CarregandoBloco /> : clientes.isError ? <ErroBloco /> : opcoesClientes.length ? (
        <Seletor rotulo="Cliente" valor={clienteId || null} onChange={setClienteId} opcoes={opcoesClientes} coluna />
      ) : (
        <Vazio texto={buscaCliente ? "Nenhum cliente encontrado para essa busca." : "Digite para buscar o cliente pelo nome, documento ou cartão."} />
      )}
      {campanhas.isLoading ? <CarregandoBloco /> : campanhas.isError ? <ErroBloco /> : opcoesCampanhas.length ? (
        <Seletor rotulo="Campanha" valor={campanhaId || null} onChange={setCampanhaId} opcoes={opcoesCampanhas} coluna />
      ) : (
        <Vazio texto="Nenhuma campanha cadastrada. Crie e publique uma campanha antes de lançar compra." />
      )}
      <CampoMoeda rotulo="Valor da compra" centavos={valor} onChange={setValor} />
      <Botao titulo="Registrar compra" icone="cash-outline" largura="cheia" carregando={registrar.isPending} onPress={() => {
        if (!clienteId || !campanhaId || !valor) return avisar.erro("Selecione cliente, campanha e valor.");
        if (campanhaSelecionada?.situacao !== "ATIVA") return avisar.erro("A campanha precisa estar No ar para receber lançamento.");
        registrar.mutate({ clienteId, campanhaId, valorCompra: valor });
      }} />
    </Folha>
  );
}

function FormularioCampanha({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoCampanha>("CARTAO_FIDELIDADE");
  const [premio, setPremio] = useState("");
  const [regra, setRegra] = useState("");
  const [publicar, setPublicar] = useState(true);
  const criar = useCriarCampanha(() => {
    setNome(""); setDescricao(""); setPremio(""); setRegra(""); onFechar();
  });
  const inicio = new Date();
  const fim = new Date(Date.now() + 30 * 86_400_000);
  return (
    <Folha visivel={visivel} titulo="Nova campanha" onFechar={onFechar}>
      <Campo rotulo="Nome" valor={nome} onChange={setNome} />
      <Campo rotulo="Descrição" valor={descricao} onChange={setDescricao} multilinha />
      <Seletor<TipoCampanha> rotulo="Tipo" valor={tipo} onChange={setTipo} opcoes={[{ valor: "CARTAO_FIDELIDADE", rotulo: "Cartão fidelidade" }, { valor: "SORTEIO", rotulo: "Sorteio" }]} />
      <Campo rotulo="Prêmio" valor={premio} onChange={setPremio} />
      <Campo rotulo={tipo === "SORTEIO" ? "Reais por cupom" : "Selos necessários"} valor={regra} onChange={setRegra} teclado="numeric" />
      <Interruptor titulo="Publicar agora" valor={publicar} onChange={setPublicar} />
      <Botao titulo="Salvar campanha" largura="cheia" carregando={criar.isPending} onPress={() => {
        if (!nome || !descricao || !premio || !regra) return avisar.erro("Preencha os campos principais.");
        const numeroRegra = Number(regra.replace(",", "."));
        criar.mutate({
          nome,
          descricao,
          tipo,
          nomePremio: premio,
          iniciaEm: paraIso(inicio),
          terminaEm: paraIso(fim),
          publicar,
          ...(tipo === "SORTEIO" ? { valorPorCupom: Math.round(numeroRegra * 100), quantidadeGanhadores: 1 } : { selosNecessarios: Math.round(numeroRegra) }),
        });
      }} />
    </Folha>
  );
}

function FormularioEntrega({ entrega, onFechar }: { entrega: Entrega | null; onFechar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [observacao, setObservacao] = useState("");
  const entregar = useEntregar();
  return (
    <Folha visivel={Boolean(entrega)} titulo="Confirmar entrega" onFechar={onFechar}>
      <Texto>{entrega?.premio}</Texto>
      <Apoio>{entrega?.cliente}</Apoio>
      <Campo rotulo="Código de retirada" valor={codigo} onChange={setCodigo} placeholder={entrega?.codigo} />
      <Campo rotulo="Observação" valor={observacao} onChange={setObservacao} multilinha />
      <Botao titulo="Confirmar entrega" icone="checkmark" largura="cheia" carregando={entregar.isPending} onPress={() => {
        if (!entrega) return;
        entregar.mutate({ id: entrega.id, codigo: codigo || undefined, observacao: observacao || undefined }, { onSuccess: onFechar });
      }} />
    </Folha>
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
      <Campo rotulo="CNPJ" valor={doc} onChange={setDoc} teclado="numeric" />
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
      <Interruptor titulo="Bloquear próprio CPF" valor={valor.bloquearProprioCpf} onChange={(v) => setValor({ ...valor, bloquearProprioCpf: v })} />
      <Interruptor titulo="Bloquear duplicados" valor={valor.bloquearDuplicados} onChange={(v) => setValor({ ...valor, bloquearDuplicados: v })} />
      <Botao titulo="Salvar" carregando={salvar.isPending} onPress={() => salvar.mutate(valor)} />
    </Cartao>
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

function Folha({ visivel, titulo, onFechar, children }: { visivel: boolean; titulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar} statusBarTranslucent>
      <View style={estilos.fundoFolha}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} accessibilityLabel="Fechar" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={estilos.ancoraFolha}>
          <View style={estilos.folha}>
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

function Indicador({ titulo, valor, icone }: { titulo: string; valor: string; icone: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <Cartao style={{ flex: 1 }}>
      <Icone nome={icone} cor={colors.primary} />
      <Numero>{valor}</Numero>
      <Apoio>{titulo}</Apoio>
    </Cartao>
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
      <View style={[estilos.logoSimbolo, grande && estilos.logoSimboloGrande]}>
        <Icone nome="ticket-outline" tamanho={grande ? 26 : 18} cor={colors.primaryForeground} />
      </View>
      <Text style={[estilos.logoTexto, grande && estilos.logoTextoGrande]}>
        Fideliza
        <Text style={estilos.logoMais}>+</Text>
      </Text>
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

const estilos = StyleSheet.create({
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
    gap: spacing.sm,
  },
  logoSimbolo: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    shadowColor: colors.heading,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  logoSimboloGrande: {
    width: 58,
    height: 58,
    borderRadius: 18,
  },
  logoTexto: {
    color: colors.heading,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  logoTextoGrande: {
    fontSize: fontSize["2xl"],
  },
  logoMais: {
    color: colors.primary,
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
  conteudoFolha: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
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
    gap: 2,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
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
  },
  cartaoCliente: {
    minHeight: 154,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cartaoClienteTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codigoCartao: {
    color: colors.primaryForeground,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
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
});
