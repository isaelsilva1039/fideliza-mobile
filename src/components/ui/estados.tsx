import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { mensagemDoErro } from "../../lib/api/errors";
import { colors, spacing } from "../../theme";
import { Apoio, Cartao, Titulo } from "./base";
import { Botao } from "./Botao";

/**
 * Carregando, vazio e erro.
 *
 * Os três estados que toda tela de dados tem, e os três que mais somem quando
 * cada tela os escreve por conta. Ficam aqui juntos para terem a mesma forma no
 * app inteiro — e para que `Conteudo` os aplique sem a tela precisar lembrar.
 */

export function Carregando({ rotulo = "Carregando" }: { rotulo?: string }) {
  return (
    <View style={estilos.centro} accessibilityRole="progressbar" accessibilityLabel={rotulo}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

/** Indicador discreto, para recarga em cima de dados já visíveis. */
export function CarregandoDiscreto() {
  return (
    <View style={{ paddingVertical: spacing.md, alignItems: "center" }}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

export function Vazio({
  icone = "file-tray-outline",
  titulo,
  descricao,
  acao,
}: {
  icone?: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  /** Diz o que fazer para sair do vazio, não só que está vazio. */
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <View style={estilos.centro}>
      <Ionicons name={icone} size={40} color={colors.border} />
      <Titulo nivel={3} style={{ marginTop: spacing.md, textAlign: "center" }}>
        {titulo}
      </Titulo>
      {descricao ? (
        <Apoio style={{ marginTop: spacing.xs, textAlign: "center", maxWidth: 300 }}>
          {descricao}
        </Apoio>
      ) : null}
      {acao ? <View style={{ marginTop: spacing.lg }}>{acao}</View> : null}
    </View>
  );
}

/**
 * O erro, com o botão de tentar de novo.
 *
 * A mensagem vem da API em português quando ela respondeu, e de `ApiError.rede`
 * quando não respondeu. Nunca aparece "Error: Network request failed".
 */
export function Erro({ erro, aoTentarNovamente }: { erro: unknown; aoTentarNovamente?: () => void }) {
  return (
    <View style={estilos.centro}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <Titulo nivel={3} style={{ marginTop: spacing.md, textAlign: "center" }}>
        Não foi possível carregar
      </Titulo>
      <Apoio style={{ marginTop: spacing.xs, textAlign: "center", maxWidth: 320 }}>
        {mensagemDoErro(erro)}
      </Apoio>
      {aoTentarNovamente ? (
        <Botao
          titulo="Tentar novamente"
          variante="secundario"
          icone="refresh"
          onPress={aoTentarNovamente}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

/** Aviso em linha, dentro de uma tela que já tem conteúdo. */
export function Alerta({
  tom = "info",
  titulo,
  descricao,
  icone,
}: {
  tom?: "info" | "atencao" | "perigo";
  titulo: string;
  descricao?: string;
  icone?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const paleta = {
    info: { fundo: colors.infoSubtle, cor: colors.info, icone: "information-circle-outline" as const },
    atencao: { fundo: colors.warningSubtle, cor: colors.warningForeground, icone: "warning-outline" as const },
    perigo: { fundo: colors.dangerSubtle, cor: colors.danger, icone: "alert-circle-outline" as const },
  }[tom];

  return (
    <View style={[estilos.alerta, { backgroundColor: paleta.fundo, borderColor: paleta.fundo }]}>
      <Ionicons name={icone ?? paleta.icone} size={18} color={paleta.cor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Titulo nivel={3} style={{ color: paleta.cor }}>
          {titulo}
        </Titulo>
        {descricao ? <Apoio style={{ color: paleta.cor }}>{descricao}</Apoio> : null}
      </View>
    </View>
  );
}

/**
 * A tela sem permissão.
 *
 * Aparece quando alguém alcança uma rota que o perfil não abrange. O menu já
 * esconde o item, então chegar aqui significa navegação por outro caminho — e o
 * texto explica em vez de só bloquear.
 */
export function SemPermissao() {
  return (
    <View style={estilos.centro}>
      <Ionicons name="lock-closed-outline" size={40} color={colors.border} />
      <Titulo nivel={3} style={{ marginTop: spacing.md, textAlign: "center" }}>
        Isto é de outro perfil
      </Titulo>
      <Apoio style={{ marginTop: spacing.xs, textAlign: "center", maxWidth: 300 }}>
        Sua conta não alcança esta área. Fale com quem administra a empresa se
        precisar de acesso.
      </Apoio>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Envelope de consulta                                                       */
/* -------------------------------------------------------------------------- */

interface ConteudoProps<T> {
  /** O resultado do hook de consulta, na forma que o TanStack Query devolve. */
  consulta: {
    data: T | undefined;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  };
  /** `true` quando os dados chegaram mas não há nada para mostrar. */
  vazio?: (dados: T) => boolean;
  aoVazio?: ReactNode;
  children: (dados: T) => ReactNode;
}

/**
 * Aplica os três estados a uma consulta.
 *
 * Existe para que a tela escreva o caso bom e nada mais — e para que nenhuma
 * esqueça o erro. `isPending` (e não `isLoading`) porque com `placeholderData` a
 * consulta paginada nunca volta a `isLoading`, e a tela ficaria em branco na
 * primeira carga.
 */
export function Conteudo<T>({ consulta, vazio, aoVazio, children }: ConteudoProps<T>) {
  if (consulta.isPending) return <Carregando />;
  if (consulta.isError) return <Erro erro={consulta.error} aoTentarNovamente={consulta.refetch} />;
  if (consulta.data === undefined) return <Carregando />;
  if (vazio?.(consulta.data)) return <>{aoVazio ?? <Vazio titulo="Nada por aqui ainda" />}</>;

  return <>{children(consulta.data)}</>;
}

/** Cartão de aviso para o que exige atenção mas não impede a tela. */
export function CartaoDeAviso({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <Cartao style={{ borderLeftColor: colors.warning, borderLeftWidth: 3 }}>
      <Titulo nivel={3}>{titulo}</Titulo>
      <Apoio>{descricao}</Apoio>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  alerta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
  },
});
