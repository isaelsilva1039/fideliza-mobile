import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useEffect, useState } from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";

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
  Interruptor,
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
import { avisar } from "../stores/avisos";
import { colors, spacing, type Tone } from "../theme";

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
  const [detalhe, setDetalhe] = useState<Entrega | null>(null);
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
                  aoDetalhar={() => setDetalhe(entrega)}
                  aoEntregar={() => setEntregar(entrega)}
                  aoCancelar={() => setCancelar(entrega)}
                />
              ))}
              <Paginacao pagina={dados} onChange={setPagina} />
            </Secao>
          )}
        </Conteudo>
      </Tela>

      <DetalheDeEntrega entrega={detalhe} aoFechar={() => setDetalhe(null)} />
      <FolhaDeEntrega entrega={entregar} aoFechar={() => setEntregar(null)} />
      <CancelamentoDeEntrega entrega={cancelar} aoFechar={() => setCancelar(null)} />
      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

function ItemDeEntrega({
  entrega,
  aoDetalhar,
  aoEntregar,
  aoCancelar,
}: {
  entrega: Entrega;
  aoDetalhar: () => void;
  aoEntregar: () => void;
  aoCancelar: () => void;
}) {
  const aguardando = entrega.situacao === "AGUARDANDO";

  return (
    <Cartao destaque={aguardando}>
      <View style={estilos.topo}>
        <Pressable style={{ flex: 1 }} onPress={aoDetalhar} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${entrega.premio}`}>
          <Titulo nivel={3} numberOfLines={2}>
            {entrega.premio}
          </Titulo>
        </Pressable>
        <Pressable onPress={aoDetalhar} accessibilityRole="button" accessibilityLabel="Ver detalhes da entrega">
          <Selo tom={TOM[entrega.situacao]}>{ROTULO_SITUACAO_ENTREGA[entrega.situacao]}</Selo>
        </Pressable>
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

function DetalheDeEntrega({ entrega, aoFechar }: { entrega: Entrega | null; aoFechar: () => void }) {
  return (
    <Folha visivel={entrega !== null} titulo="Detalhes da entrega" aoFechar={aoFechar} grande>
      {entrega ? (
        <>
          <Cartao>
            <Titulo nivel={3}>{entrega.premio}</Titulo>
            <Apoio>{entrega.campanha}</Apoio>
            <Divisor />
            <Linha rotulo="Status">
              <Selo tom={TOM[entrega.situacao]}>{ROTULO_SITUACAO_ENTREGA[entrega.situacao]}</Selo>
            </Linha>
            <Linha rotulo="Cliente">{entrega.cliente}</Linha>
            <Linha rotulo="Telefone">{formatarTelefone(entrega.telefoneCliente)}</Linha>
            <Linha rotulo="Código">{entrega.codigo}</Linha>
            <Linha rotulo="Solicitado">{data(entrega.solicitadoEm)}</Linha>
            {entrega.entregueEm ? <Linha rotulo="Entregue">{data(entrega.entregueEm)}</Linha> : null}
          </Cartao>

          {entrega.situacao === "ENTREGUE" ? (
            <Cartao>
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
            <View style={{ gap: spacing.xs }}>
              <Rotulo>Como retirar</Rotulo>
              <Texto>{entrega.instrucoesRetirada}</Texto>
            </View>
          ) : null}

          {entrega.observacao ? (
            <View style={{ gap: spacing.xs }}>
              <Rotulo>Observação</Rotulo>
              <Texto>{entrega.observacao}</Texto>
            </View>
          ) : null}

          <Botao titulo="Fechar" variante="secundario" onPress={aoFechar} />
        </>
      ) : null}
    </Folha>
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
  const [documentoConferido, setDocumentoConferido] = useState("");
  const [entregarParaTerceiro, setEntregarParaTerceiro] = useState(false);
  const [recebedorNome, setRecebedorNome] = useState("");
  const [recebedorDocumento, setRecebedorDocumento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [scannerAberto, setScannerAberto] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const entregar = useEntregar();

  useEffect(() => {
    if (entrega) {
      setCodigo("");
      setDocumentoConferido("");
      setEntregarParaTerceiro(false);
      setRecebedorNome("");
      setRecebedorDocumento("");
      setObservacao("");
      setScannerAberto(false);
    }
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
      <Folha
        visivel={entrega !== null}
        titulo="Confirmar entrega"
        aoFechar={aoFechar}
        grande
        rodape={
          <>
            <Botao titulo="Voltar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
            <Botao
              titulo="Entregar"
              carregando={entregar.isPending}
              onPress={() => {
                if (!entrega) return;
                if (entregarParaTerceiro && !recebedorNome.trim()) {
                  avisar.erro("Informe quem retirou o prêmio.");
                  return;
                }
                if (!codigo.trim() && !documentoConferido.trim() && !entregarParaTerceiro) {
                  avisar.erro("Leia o QR, digite o CPF ou informe o código do prêmio.");
                  return;
                }
                entregar.mutate(
                  {
                    id: entrega.id,
                    codigo: codigo.trim() || undefined,
                    documentoConferido: documentoConferido.trim() || undefined,
                    entregarParaTerceiro,
                    recebedorNome: recebedorNome.trim() || undefined,
                    recebedorDocumento: recebedorDocumento.trim() || undefined,
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

            <Cartao>
              <Rotulo>Conferir cliente</Rotulo>
              <Apoio>Leia o QR do cliente ou digite CPF/código do cartão.</Apoio>
              <Botao titulo="Ler QR do cliente" icone="qr-code-outline" variante="secundario" onPress={abrirScanner} />
              <Campo
                rotulo="CPF ou QR/código"
                valor={documentoConferido}
                onChange={setDocumentoConferido}
                placeholder="CPF ou FID-000000"
                autoCapitalize="characters"
              />
            </Cartao>

            <Interruptor
              titulo="Entregar para outra pessoa"
              descricao="Use quando quem retirou não é o titular do prêmio."
              valor={entregarParaTerceiro}
              onChange={setEntregarParaTerceiro}
            />

            {entregarParaTerceiro ? (
              <Cartao>
                <Campo
                  rotulo="Nome de quem retirou"
                  valor={recebedorNome}
                  onChange={setRecebedorNome}
                  placeholder="Nome completo"
                />
                <Campo
                  rotulo="CPF/documento de quem retirou"
                  valor={recebedorDocumento}
                  onChange={setRecebedorDocumento}
                  placeholder="Opcional, mas recomendado"
                  teclado="numeric"
                />
              </Cartao>
            ) : null}

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
      <ScannerQrEntrega
        visivel={scannerAberto}
        aoFechar={() => setScannerAberto(false)}
        aoLer={(valor) => {
          setDocumentoConferido(textoBuscaDoQr(valor));
          setScannerAberto(false);
          avisar.informacao("QR lido. Confira antes de confirmar a entrega.");
        }}
      />
    </>
  );
}

function ScannerQrEntrega({
  visivel,
  aoFechar,
  aoLer,
}: {
  visivel: boolean;
  aoFechar: () => void;
  aoLer: (valor: string) => void;
}) {
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    if (visivel) setBloqueado(false);
  }, [visivel]);

  const onBarcodeScanned = (resultado: BarcodeScanningResult) => {
    if (bloqueado || !resultado.data) return;
    setBloqueado(true);
    aoLer(resultado.data);
  };

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={estilos.scannerHeader}>
          <View style={{ flex: 1 }}>
            <Titulo nivel={2}>Ler QR do cliente</Titulo>
            <Apoio>Aponte para o QR do cartão Fideliza+.</Apoio>
          </View>
          <BotaoIcone icone="close" rotulo="Fechar" onPress={aoFechar} />
        </View>
        <CameraView
          style={estilos.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={bloqueado ? undefined : onBarcodeScanned}
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
  scannerHeader: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: 1,
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
});
