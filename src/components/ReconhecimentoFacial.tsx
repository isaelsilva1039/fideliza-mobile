import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, SafeAreaView, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { Apoio, Botao, Icone, Texto, Titulo } from "./ui";
import { colors, radius, spacing } from "../theme";

type Estado = "carregando" | "pronto" | "analisando" | "erro";
type MensagemWeb =
  | { tipo: "pronto" }
  | { tipo: "vetor"; vetor: number[] }
  | { tipo: "sem-rosto" }
  | { tipo: "erro"; mensagem?: string };

const AMOSTRAS_CADASTRO = 3;
const HUMAN_BASE_URL = (
  process.env.EXPO_PUBLIC_HUMAN_BASE_URL ??
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6"
).replace(/\/$/, "");

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A câmera é nativa; somente a foto temporária é entregue ao TensorFlow dentro
 * do WebView. O componente devolve o descritor FaceRes e descarta a imagem.
 */
export function ReconhecimentoFacial({
  visivel,
  modo,
  titulo,
  onFechar,
  onConcluir,
}: {
  visivel: boolean;
  modo: "cadastro" | "reconhecimento";
  titulo: string;
  onFechar: () => void;
  onConcluir: (vetor: number[]) => Promise<void> | void;
}) {
  const camera = useRef<CameraView>(null);
  const webview = useRef<WebView>(null);
  const resolver = useRef<((mensagem: MensagemWeb) => void) | null>(null);
  const limiteDaAnalise = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturaAutomatica = useRef(false);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [motorAtivado, setMotorAtivado] = useState(false);
  const [motorPronto, setMotorPronto] = useState(false);
  const [cameraPronta, setCameraPronta] = useState(false);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagem, setMensagem] = useState("Preparando o reconhecimento facial…");

  const html = useMemo(() => htmlDoTensorFlow(HUMAN_BASE_URL), []);

  useEffect(() => {
    if (!visivel) {
      capturaAutomatica.current = false;
      setCameraPronta(false);
      resolver.current = null;
      if (limiteDaAnalise.current) clearTimeout(limiteDaAnalise.current);
      limiteDaAnalise.current = null;
      return;
    }

    setMotorAtivado(true);
    setEstado("carregando");
    setMensagem("Abrindo a câmera e preparando o reconhecimento…");
    if (!permissao?.granted) {
      void pedirPermissao().then((resultado) => {
        if (!resultado.granted) {
          setEstado("erro");
          setMensagem("O acesso à câmera foi bloqueado. Libere a câmera nas permissões do aplicativo.");
        }
      });
    }
  }, [visivel, permissao?.granted, pedirPermissao]);

  useEffect(() => {
    if (!visivel || !permissao?.granted || !motorPronto || !cameraPronta || capturaAutomatica.current) return;
    capturaAutomatica.current = true;
    setEstado("pronto");
    setMensagem("Centralize o rosto. A leitura começa automaticamente.");
    const temporizador = setTimeout(() => void capturar(), 450);
    return () => clearTimeout(temporizador);
  }, [visivel, permissao?.granted, motorPronto, cameraPronta]);

  function receberMensagem(evento: WebViewMessageEvent) {
    try {
      const recebida = JSON.parse(evento.nativeEvent.data) as MensagemWeb;
      if (recebida.tipo === "pronto") {
        setMotorPronto(true);
        return;
      }
      if (recebida.tipo === "erro" && !resolver.current) {
        setEstado("erro");
        setMensagem("Não foi possível carregar o TensorFlow. Verifique a internet e tente novamente.");
        return;
      }
      if (limiteDaAnalise.current) clearTimeout(limiteDaAnalise.current);
      limiteDaAnalise.current = null;
      resolver.current?.(recebida);
      resolver.current = null;
    } catch {
      if (limiteDaAnalise.current) clearTimeout(limiteDaAnalise.current);
      limiteDaAnalise.current = null;
      resolver.current?.({ tipo: "erro", mensagem: "Resposta inválida do reconhecimento." });
      resolver.current = null;
    }
  }

  async function analisarFoto(base64: string) {
    const resposta = new Promise<MensagemWeb>((resolve) => {
      resolver.current = resolve;
      limiteDaAnalise.current = setTimeout(() => {
        resolver.current = null;
        resolve({ tipo: "erro", mensagem: "O reconhecimento demorou mais que o esperado." });
      }, 30_000);
    });
    webview.current?.injectJavaScript(
      `window.analisarImagem(${JSON.stringify(`data:image/jpeg;base64,${base64}`)}); true;`,
    );
    return resposta;
  }

  async function capturar() {
    if (!camera.current || !motorPronto || estado === "analisando") return;

    setEstado("analisando");
    const necessarias = modo === "cadastro" ? AMOSTRAS_CADASTRO : 1;
    const maximoTentativas = modo === "cadastro" ? 6 : 4;
    const amostras: number[][] = [];

    try {
      for (let tentativa = 0; tentativa < maximoTentativas && amostras.length < necessarias; tentativa++) {
        setMensagem(
          modo === "cadastro"
            ? `Cadastrando o rosto: leitura ${amostras.length + 1} de ${necessarias}…`
            : "Analisando o rosto…",
        );
        const foto = await camera.current.takePictureAsync({ base64: true, quality: 0.5 });
        if (!foto?.base64) throw new Error("A câmera não devolveu a imagem.");
        const resultado = await analisarFoto(foto.base64);
        if (resultado.tipo === "vetor" && resultado.vetor.length >= 500) amostras.push(resultado.vetor);
        if (resultado.tipo === "erro") throw new Error(resultado.mensagem);
        if (amostras.length < necessarias) await esperar(100);
      }

      if (amostras.length !== necessarias) {
        setEstado("pronto");
        setMensagem("Não encontrei um rosto válido. Ajuste o enquadramento e tente manualmente.");
        return;
      }

      const vetor = amostras[0].map(
        (_, indice) => amostras.reduce((soma, amostra) => soma + amostra[indice], 0) / amostras.length,
      );
      setMensagem(modo === "cadastro" ? "Rosto registrado. Nenhuma foto foi salva." : "Rosto identificado. Procurando o cadastro…");
      await onConcluir(vetor);
    } catch (erro) {
      console.error("Falha no reconhecimento facial", erro);
      setEstado("pronto");
      setMensagem("Não foi possível concluir a leitura. Tente novamente.");
    }
  }

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <SafeAreaView style={estilos.safe}>
        <View style={estilos.cabecalho}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Titulo nivel={2}>{titulo}</Titulo>
            <Apoio>A foto é processada neste aparelho e não é armazenada.</Apoio>
          </View>
          <Botao titulo="Fechar" variante="sutil" compacto onPress={onFechar} />
        </View>

        {permissao?.granted ? (
          <CameraView
            ref={camera}
            style={estilos.camera}
            facing="front"
            mirror
            onCameraReady={() => setCameraPronta(true)}
          >
            <View style={estilos.mira}>
              <View style={estilos.rosto} />
            </View>
          </CameraView>
        ) : (
          <View style={estilos.semCamera}>
            <Icone nome="camera-outline" tamanho={42} cor={colors.muted} />
            <Texto>{mensagem}</Texto>
          </View>
        )}

        <View style={estilos.rodape}>
          <Apoio>{mensagem}</Apoio>
          <Botao
            titulo={estado === "analisando" ? "Analisando" : "Tentar manualmente"}
            icone="camera-outline"
            largura="cheia"
            variante="secundario"
            carregando={estado === "analisando" || estado === "carregando"}
            desabilitado={!motorPronto || !cameraPronta || estado === "analisando"}
            onPress={() => void capturar()}
          />
        </View>

        {motorAtivado ? (
          <WebView
            ref={webview}
            source={{ html }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            androidLayerType="hardware"
            onMessage={receberMensagem}
            onError={() => {
              setEstado("erro");
              setMensagem("Não foi possível carregar o TensorFlow. Verifique a internet e tente novamente.");
            }}
            style={estilos.motor}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function htmlDoTensorFlow(baseUrl: string) {
  const base = JSON.stringify(baseUrl);
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body><script src="${baseUrl}/dist/human.js"></script><script>
(async function () {
  const enviar = (valor) => window.ReactNativeWebView.postMessage(JSON.stringify(valor));
  try {
    const base = ${base};
    const human = new Human.Human({
      backend: 'webgl', modelBasePath: base + '/models/', cacheModels: true, debug: false,
      filter: { enabled: true, width: 480, height: 360 },
      face: {
        enabled: true,
        detector: { enabled: true, rotation: false, return: true, maxDetected: 1, minConfidence: 0.35 },
        mesh: { enabled: true }, description: { enabled: true }, iris: { enabled: false },
        emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false }
      },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
      gesture: { enabled: false }, segmentation: { enabled: false }
    });
    await human.load();
    window.analisarImagem = async function (origem) {
      try {
        const imagem = new Image();
        await new Promise((resolve, reject) => {
          imagem.onload = resolve; imagem.onerror = reject; imagem.src = origem;
        });
        const resultado = await human.detect(imagem);
        const vetor = resultado.face.length === 1 ? resultado.face[0].embedding : undefined;
        enviar(vetor && vetor.length >= 500 ? { tipo: 'vetor', vetor: Array.from(vetor) } : { tipo: 'sem-rosto' });
      } catch (erro) {
        enviar({ tipo: 'erro', mensagem: String(erro && erro.message ? erro.message : erro) });
      }
    };
    enviar({ tipo: 'pronto' });
  } catch (erro) {
    enviar({ tipo: 'erro', mensagem: String(erro && erro.message ? erro.message : erro) });
  }
})();
</script></body></html>`;
}

const estilos = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  camera: { flex: 1, marginHorizontal: spacing.md, borderRadius: radius.none, overflow: "hidden" },
  mira: { flex: 1, alignItems: "center", justifyContent: "center" },
  rosto: { width: 230, height: 300, borderRadius: 120, borderWidth: 3, borderColor: colors.primary },
  semCamera: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  rodape: { gap: spacing.sm, padding: spacing.md },
  motor: { position: "absolute", width: 8, height: 8, left: -20, bottom: -20, opacity: 0.01 },
});
