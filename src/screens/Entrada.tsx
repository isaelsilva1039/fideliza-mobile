import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { Apoio, Botao, Campo, Titulo } from "../components/ui";
import { errosPorCampo, mensagemDoErro } from "../lib/api/errors";
import { entrar } from "../services";
import { avisar } from "../stores/avisos";
import { useSession } from "../stores/session";
import { colors, fontSize, spacing } from "../theme";

/**
 * A entrada da equipe.
 *
 * A tela do cliente é outra (`Portal`) e não pede senha — o consumidor nunca
 * teve conta aqui. O caminho para ela fica visível desde o começo, porque quem
 * abre este app pela primeira vez costuma ser o cliente, não o balcão.
 */
export function Entrada({ aoIrParaPortal }: { aoIrParaPortal: () => void }) {
  const setSession = useSession((estado) => estado.setSession);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  const login = useMutation({
    mutationFn: () => entrar(email.trim(), senha),
    onSuccess: (sessao) => {
      setErros({});
      void setSession(sessao);
    },
    onError: (erro) => {
      // O servidor manda `errosPorCampo` quando o formato está errado, e só
      // `mensagem` quando a credencial não confere. Os dois caminhos aparecem.
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) avisar.erro(mensagemDoErro(erro));
    },
  });

  const podeEnviar = email.trim().length > 0 && senha.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={estilos.raiz}
    >
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.marca}>
          <Titulo nivel={1} style={{ fontSize: fontSize["3xl"] }}>
            Fideliza+
          </Titulo>
          <Apoio>Cartão fidelidade e sorteio, sem papel.</Apoio>
        </View>

        <View style={{ gap: spacing.lg }}>
          <Campo
            rotulo="E-mail"
            valor={email}
            onChange={setEmail}
            placeholder="voce@empresa.com"
            teclado="email-address"
            autoCapitalize="none"
            erro={erros.email}
          />

          <Campo
            rotulo="Senha"
            valor={senha}
            onChange={setSenha}
            placeholder="Sua senha"
            segredo
            autoCapitalize="none"
            erro={erros.senha}
          />

          <Botao
            titulo="Entrar"
            largura="cheia"
            onPress={() => login.mutate()}
            carregando={login.isPending}
            desabilitado={!podeEnviar}
          />
        </View>

        <View style={estilos.divisorTexto}>
          <View style={estilos.risco} />
          <Apoio>ou</Apoio>
          <View style={estilos.risco} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Botao
            titulo="Consultar meu cartão"
            variante="secundario"
            icone="card-outline"
            largura="cheia"
            onPress={aoIrParaPortal}
          />
          <Apoio style={{ textAlign: "center" }}>
            Para clientes. Consulte selos, cupons e prêmios só com seu CPF.
          </Apoio>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: colors.background,
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  marca: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  divisorTexto: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  risco: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
});
