import { useEffect, useState } from "react";
import { View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Botao,
  Cartao,
  Conteudo,
  Divisor,
  Interruptor,
  Secao,
  SemPermissao,
} from "../components/ui";
import { pode } from "../constants/permissoes";
import { useConfiguracao, useSalvarConfiguracao } from "../hooks/use-queries";
import type { Configuracao } from "../services/contrato";
import { useEmpresas, useSession, useUsuario } from "../stores/session";
import { spacing } from "../theme";

/**
 * As configurações.
 *
 * Três chaves, e cada uma existe por causa de um problema real de balcão. O texto
 * de apoio diz qual — sem isso, "Bloquear duplicados" é uma chave que ninguém
 * ousa mexer por não saber o que quebra.
 *
 * Salvar é explícito, e não a cada toque: são regras que mudam o que o balcão
 * consegue fazer, e alternar sem confirmar deixaria o caixa travado por um toque
 * acidental durante a rolagem.
 */
export function Configuracoes({ aoVoltar }: { aoVoltar: () => void }) {
  const usuario = useUsuario();
  const consulta = useConfiguracao();
  const salvar = useSalvarConfiguracao();

  const [rascunho, setRascunho] = useState<Configuracao | null>(null);

  // O rascunho parte do que o servidor tem. Um refetch depois de salvar não pode
  // sobrescrever o que está sendo editado, então só sincroniza quando ainda não
  // há rascunho.
  useEffect(() => {
    if (consulta.data && rascunho === null) setRascunho(consulta.data);
  }, [consulta.data, rascunho]);

  const empresas = useEmpresas();
  const empresaAtivaId = useSession((estado) => estado.session?.empresaAtivaId);
  const empresaAtiva = empresas.find((e) => e.id === empresaAtivaId);

  if (!pode(usuario, "configuracoes.gerenciar")) {
    return (
      <Tela titulo="Configurações" aoVoltar={aoVoltar}>
        <SemPermissao />
      </Tela>
    );
  }

  const sujo =
    rascunho !== null &&
    consulta.data !== undefined &&
    (rascunho.avisarCliente !== consulta.data.avisarCliente ||
      rascunho.bloquearProprioCpf !== consulta.data.bloquearProprioCpf ||
      rascunho.bloquearDuplicados !== consulta.data.bloquearDuplicados);

  return (
    <Tela
      titulo="Configurações"
      subtitulo={empresaAtiva?.nomeFantasia}
      aoVoltar={aoVoltar}
      rodape={
        sujo ? (
          <>
            <Botao
              titulo="Descartar"
              variante="secundario"
              onPress={() => setRascunho(consulta.data ?? null)}
              style={{ flex: 1 }}
            />
            <Botao
              titulo="Salvar"
              carregando={salvar.isPending}
              onPress={() => {
                if (!rascunho) return;
                salvar.mutate(rascunho);
              }}
              style={{ flex: 1 }}
            />
          </>
        ) : undefined
      }
    >
      <Conteudo consulta={consulta}>
        {() =>
          rascunho ? (
            <View style={{ gap: spacing.lg }}>
              <Secao titulo="Regras do balcão">
                <Cartao>
                  <Interruptor
                    titulo="Avisar o cliente"
                    descricao="Manda mensagem quando o cartão completa ou o prêmio fica pronto para retirar."
                    valor={rascunho.avisarCliente}
                    onChange={(valor) => setRascunho({ ...rascunho, avisarCliente: valor })}
                  />
                  <Divisor />
                  <Interruptor
                    titulo="Bloquear o próprio CPF"
                    descricao="Impede que quem atende registre compras no próprio documento — o desvio mais comum, e o mais fácil de evitar."
                    valor={rascunho.bloquearProprioCpf}
                    onChange={(valor) => setRascunho({ ...rascunho, bloquearProprioCpf: valor })}
                  />
                  <Divisor />
                  <Interruptor
                    titulo="Bloquear duplicados"
                    descricao="Recusa dois lançamentos iguais para o mesmo cliente em sequência. Evita o selo dobrado por toque duplo."
                    valor={rascunho.bloquearDuplicados}
                    onChange={(valor) => setRascunho({ ...rascunho, bloquearDuplicados: valor })}
                  />
                </Cartao>
              </Secao>

              <Apoio>
                As três regras valem para {empresaAtiva?.nomeFantasia ?? "a empresa ativa"} e não
                afetam as outras empresas.
              </Apoio>
            </View>
          ) : null
        }
      </Conteudo>
    </Tela>
  );
}
