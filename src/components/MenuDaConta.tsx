import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { pode } from "../constants/permissoes";
import { useEmpresasDoUsuario } from "../hooks/use-queries";
import { sair as sairDaApi } from "../services";
import { ROTULO_PERFIL, type Empresa } from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useSession } from "../stores/session";
import { colors, fontSize, spacing, touchTarget } from "../theme";
import { Apoio, Avatar, Divisor, Rotulo, Texto, Titulo } from "./ui/base";
import { Botao } from "./ui/Botao";
import { Folha } from "./ui/Folha";
import { CarregandoDiscreto } from "./ui/estados";

/**
 * O menu da conta — quem sou, em qual empresa estou, e a saída.
 *
 * Configurações mora aqui e não no menu principal, como no painel web: é algo
 * que se mexe uma vez e some, e ocuparia no rodapé um lugar que o balcão usa o
 * dia inteiro.
 *
 * A troca de empresa é a razão principal desta folha existir. Trocar só muda
 * `empresaAtivaId` na sessão; como toda chave de consulta começa por ele, o
 * TanStack Query recarrega tudo sozinho.
 */
export function MenuDaConta({ visivel, aoFechar }: { visivel: boolean; aoFechar: () => void }) {
  const session = useSession((estado) => estado.session);
  const setEmpresaAtiva = useSession((estado) => estado.setEmpresaAtiva);
  const limparSessao = useSession((estado) => estado.clear);
  const reiniciarNavegacao = useNavegacao((estado) => estado.reiniciar);
  const abrir = useNavegacao((estado) => estado.abrir);
  const queryClient = useQueryClient();

  // A lista vem da rede, mas a sessão já traz uma cópia — é ela que aparece
  // enquanto a consulta não responde, para a folha nunca abrir vazia.
  const consulta = useEmpresasDoUsuario();
  const empresas: Empresa[] = consulta.data ?? session?.empresas ?? [];

  if (!session) return null;
  const { usuario } = session;

  const trocar = async (empresaId: string) => {
    await setEmpresaAtiva(empresaId);
    // A pilha de navegação vira sem sentido na empresa nova: a ficha aberta era
    // de um cliente que a outra empresa não alcança.
    reiniciarNavegacao();
    aoFechar();
  };

  const sair = async () => {
    // A saída não espera a rede: o backend não guarda estado de sessão, então
    // falhar aqui não pode impedir alguém de sair do app num aparelho alheio.
    void sairDaApi().catch(() => undefined);
    await limparSessao();
    reiniciarNavegacao();
    queryClient.clear();
    aoFechar();
  };

  return (
    <Folha visivel={visivel} titulo="Sua conta" aoFechar={aoFechar}>
      <View style={estilos.identidade}>
        <Avatar nome={usuario.nome} tamanho={44} />
        <View style={{ flex: 1 }}>
          <Titulo nivel={2} numberOfLines={1}>
            {usuario.nome}
          </Titulo>
          <Apoio numberOfLines={1}>{usuario.email}</Apoio>
          <Apoio>{ROTULO_PERFIL[usuario.perfil]}</Apoio>
        </View>
      </View>

      <Divisor />

      <View style={{ gap: spacing.sm }}>
        <Rotulo>Empresa ativa</Rotulo>
        {consulta.isPending && empresas.length === 0 ? <CarregandoDiscreto /> : null}

        {empresas.map((empresa) => {
          const ativa = empresa.id === session.empresaAtivaId;
          const inativa = empresa.situacao === "INATIVA";

          return (
            <Pressable
              key={empresa.id}
              onPress={() => void trocar(empresa.id)}
              disabled={ativa}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={empresa.nomeFantasia}
              style={({ pressed }) => [
                estilos.empresa,
                ativa
                  ? { borderColor: colors.primary, backgroundColor: colors.accent, borderWidth: 2 }
                  : { borderColor: colors.border, backgroundColor: colors.surface },
                pressed && !ativa && { opacity: 0.7 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Texto numberOfLines={1}>{empresa.nomeFantasia}</Texto>
                {inativa ? <Apoio>Desativada</Apoio> : null}
              </View>
              {ativa ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}

        {empresas.length === 1 ? (
          <Apoio>Você atende uma empresa. O seletor aparece quando houver mais.</Apoio>
        ) : null}
      </View>

      <Divisor />

      {pode(usuario, "configuracoes.gerenciar") ? (
        <Botao
          titulo="Configurações"
          variante="secundario"
          icone="settings-outline"
          largura="cheia"
          onPress={() => {
            abrir({ nome: "configuracoes" });
            aoFechar();
          }}
        />
      ) : null}

      <Botao
        titulo="Sair"
        variante="perigo"
        icone="log-out-outline"
        largura="cheia"
        onPress={() => void sair()}
      />

      {/* O aviso é para quem instala o app, não para o balcão — mas fica onde
          quem testa vai olhar. */}
      <Apoio style={{ fontSize: fontSize.xs }}>
        Autenticação por cabeçalho, apenas para desenvolvimento. Exige JWT antes de
        publicar.
      </Apoio>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  identidade: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  empresa: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
});
