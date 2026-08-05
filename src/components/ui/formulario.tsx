import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { centavosDeTexto, moedaSemSimbolo } from "../../lib/format";
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from "../../theme";
import { Apoio, Rotulo } from "./base";

/**
 * Os controles de formulário.
 *
 * Todo campo aceita `erro`, e o erro vem da API — `errosPorCampo` do backend cai
 * direto aqui. A mensagem aparece embaixo do campo e a borda fica vermelha, para
 * quem está no balcão não precisar procurar o que deu errado numa lista no topo.
 */

/* -------------------------------------------------------------------------- */
/* Campo de texto                                                             */
/* -------------------------------------------------------------------------- */

interface CampoProps {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  erro?: string;
  /** Frase de apoio abaixo do campo, quando não há erro. */
  dica?: string;
  teclado?: KeyboardTypeOptions;
  segredo?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multilinha?: boolean;
  maxLength?: number;
  editavel?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Campo({
  rotulo,
  valor,
  onChange,
  placeholder,
  erro,
  dica,
  teclado = "default",
  segredo = false,
  autoCapitalize = "sentences",
  multilinha = false,
  maxLength,
  editavel = true,
  style,
}: CampoProps) {
  const [focado, setFocado] = useState(false);

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput
        value={valor}
        onChangeText={onChange}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={teclado}
        secureTextEntry={segredo}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multilinha}
        maxLength={maxLength}
        editable={editavel}
        accessibilityLabel={rotulo}
        style={[
          estilos.entrada,
          multilinha && { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md },
          focado && { borderColor: colors.ring, borderWidth: 2 },
          Boolean(erro) && { borderColor: colors.danger, borderWidth: 2 },
          !editavel && { backgroundColor: colors.surfaceMuted, color: colors.muted },
        ]}
      />
      {erro ? (
        <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{erro}</Text>
      ) : dica ? (
        <Apoio>{dica}</Apoio>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Campo de dinheiro                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Valor em reais, guardado em centavos.
 *
 * A API recebe `long` em centavos e valida `@Positive`. Deixar a tela mandar
 * reais faria R$ 32,00 virar 32 centavos — o erro não apareceria em teste com
 * valores redondos e apareceria no caixa no fim do dia. Por isso a conversão vive
 * aqui e o `onChange` já entrega centavos.
 */
export function CampoMoeda({
  rotulo,
  centavos,
  onChange,
  erro,
  dica,
  autoFocus = false,
}: {
  rotulo: string;
  centavos: number | null;
  onChange: (centavos: number | null) => void;
  erro?: string;
  dica?: string;
  autoFocus?: boolean;
}) {
  // O texto é estado próprio: reformatar a cada tecla impediria digitar "32,0".
  const [texto, setTexto] = useState(centavos === null ? "" : moedaSemSimbolo(centavos));
  const [focado, setFocado] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Rotulo>{rotulo}</Rotulo>
      <View
        style={[
          estilos.entrada,
          estilos.moedaContainer,
          focado && { borderColor: colors.ring, borderWidth: 2 },
          Boolean(erro) && { borderColor: colors.danger, borderWidth: 2 },
        ]}
      >
        <Text style={{ color: colors.muted, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
          R$
        </Text>
        <TextInput
          value={texto}
          onChangeText={(bruto) => {
            setTexto(bruto);
            onChange(centavosDeTexto(bruto));
          }}
          onFocus={() => setFocado(true)}
          onBlur={() => {
            setFocado(false);
            // Ao sair do campo, normaliza para "32,00" — confirma o que foi lido.
            const lido = centavosDeTexto(texto);
            setTexto(lido === null ? "" : moedaSemSimbolo(lido));
          }}
          placeholder="0,00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          accessibilityLabel={rotulo}
          style={estilos.moedaEntrada}
        />
      </View>
      {erro ? (
        <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{erro}</Text>
      ) : dica ? (
        <Apoio>{dica}</Apoio>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Seletor                                                                    */
/* -------------------------------------------------------------------------- */

export interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
  /** Frase curta explicando a opção — aparece abaixo do rótulo. */
  dica?: string;
}

/**
 * Escolha entre poucas opções, desenhada como fileira de botões.
 *
 * Não é um `Picker` nativo de propósito: o do Android abre um diálogo modal e o
 * do iOS uma roda, e os dois esconderiam de duas a quatro opções atrás de um
 * toque. Aqui todas ficam visíveis, e a escolhida é óbvia sem abrir nada.
 */
export function Seletor<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  erro,
  coluna = false,
}: {
  rotulo?: string;
  opcoes: ReadonlyArray<Opcao<T>>;
  valor: T | null;
  onChange: (valor: T) => void;
  erro?: string;
  /** Empilha as opções — use quando houver dica em cada uma. */
  coluna?: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {rotulo ? <Rotulo>{rotulo}</Rotulo> : null}
      <View style={[estilos.grupoOpcoes, coluna && { flexDirection: "column" }]}>
        {opcoes.map((opcao) => {
          const ativo = opcao.valor === valor;
          return (
            <Pressable
              key={opcao.valor}
              onPress={() => onChange(opcao.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={opcao.rotulo}
              style={({ pressed }) => [
                estilos.opcao,
                coluna && { alignSelf: "stretch" },
                ativo
                  ? { backgroundColor: colors.accent, borderColor: colors.primary, borderWidth: 2 }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={{
                  color: ativo ? colors.accentForeground : colors.foreground,
                  fontSize: fontSize.sm,
                  fontWeight: ativo ? fontWeight.semibold : fontWeight.regular,
                }}
              >
                {opcao.rotulo}
              </Text>
              {opcao.dica ? <Apoio style={{ marginTop: 2 }}>{opcao.dica}</Apoio> : null}
            </Pressable>
          );
        })}
      </View>
      {erro ? <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{erro}</Text> : null}
    </View>
  );
}

/**
 * Filtro de múltipla escolha — as "pílulas" das listagens.
 *
 * Nada selecionado significa "tudo", e é o estado inicial: uma listagem que abre
 * filtrada esconde dados sem dizer que escondeu.
 */
export function Filtros<T extends string>({
  opcoes,
  selecionados,
  onChange,
}: {
  opcoes: ReadonlyArray<Opcao<T>>;
  selecionados: readonly T[];
  onChange: (selecionados: T[]) => void;
}) {
  const alternar = (valor: T) =>
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor],
    );

  return (
    <View style={estilos.grupoOpcoes}>
      {opcoes.map((opcao) => {
        const ativo = selecionados.includes(opcao.valor);
        return (
          <Pressable
            key={opcao.valor}
            onPress={() => alternar(opcao.valor)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ativo }}
            accessibilityLabel={opcao.rotulo}
            style={({ pressed }) => [
              estilos.pilula,
              ativo
                ? { backgroundColor: colors.accent, borderColor: colors.primary }
                : { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={{
                color: ativo ? colors.accentForeground : colors.muted,
                fontSize: fontSize.sm,
                fontWeight: ativo ? fontWeight.semibold : fontWeight.regular,
              }}
            >
              {opcao.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Interruptor                                                                */
/* -------------------------------------------------------------------------- */

export function Interruptor({
  titulo,
  descricao,
  valor,
  onChange,
  desabilitado = false,
}: {
  titulo: string;
  descricao?: string;
  valor: boolean;
  onChange: (valor: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <Pressable
      onPress={() => !desabilitado && onChange(!valor)}
      accessibilityRole="switch"
      accessibilityState={{ checked: valor, disabled: desabilitado }}
      accessibilityLabel={titulo}
      style={estilos.interruptor}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>
          {titulo}
        </Text>
        {descricao ? <Apoio>{descricao}</Apoio> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        disabled={desabilitado}
        trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.surfaceMuted}
      />
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Busca                                                                      */
/* -------------------------------------------------------------------------- */

export function Busca({
  valor,
  onChange,
  placeholder = "Buscar",
}: {
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={estilos.busca}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={estilos.buscaEntrada}
      />
      {valor ? (
        <Pressable onPress={() => onChange("")} hitSlop={10} accessibilityLabel="Limpar busca">
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  entrada: {
    minHeight: touchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.none,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
    fontSize: fontSize.md,
  },
  moedaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  moedaEntrada: {
    flex: 1,
    color: colors.foreground,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    padding: 0,
  },
  grupoOpcoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  opcao: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.none,
  },
  pilula: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.none,
  },
  interruptor: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    minHeight: touchTarget,
    paddingVertical: spacing.sm,
  },
  busca: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.none,
    paddingHorizontal: spacing.md,
  },
  buscaEntrada: {
    flex: 1,
    color: colors.foreground,
    fontSize: fontSize.md,
    padding: 0,
  },
});
