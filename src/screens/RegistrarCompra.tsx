import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Alerta,
  Apoio,
  Botao,
  Busca,
  CampoMoeda,
  Cartao,
  Carregando,
  Divisor,
  Icone,
  Linha,
  Rotulo,
  Secao,
  Selo,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { useCampanhas, useClientes, useFichaCliente, useRegistrarCompra } from "../hooks/use-queries";
import { documento as formatarDocumento, moeda, plural, telefone as formatarTelefone } from "../lib/format";
import { ROTULO_TIPO_CAMPANHA, type Campanha, type Cliente } from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { colors, spacing } from "../theme";

/**
 * Registrar compra — a tela que o balcão mais usa.
 *
 * Três escolhas em ordem: quem, qual campanha, quanto. Quando já se sabe o
 * cliente (veio da ficha) ou a campanha (veio do detalhe), o passo correspondente
 * já vem resolvido e a tela abre no que falta.
 *
 * O valor sai daqui em **centavos**, porque é o que a API recebe. Mandar reais
 * faria R$ 32,00 virar 32 centavos — um erro que não aparece em teste com valores
 * redondos e aparece no fechamento do caixa.
 */
export function RegistrarCompra({
  clienteId: clienteInicial,
  campanhaId: campanhaInicial,
  aoVoltar,
}: {
  clienteId?: string;
  campanhaId?: string;
  aoVoltar: () => void;
}) {
  const abrir = useNavegacao((estado) => estado.abrir);

  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [campanhaId, setCampanhaId] = useState(campanhaInicial ?? "");
  const [centavos, setCentavos] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  // Só as campanhas que aceitam lançamento agora. Oferecer rascunho ou encerrada
  // seria oferecer um caminho que o servidor recusa.
  const campanhas = useCampanhas({ situacao: ["ATIVA"], tamanho: 50 });
  const clientes = useClientes({ busca: busca.trim() || undefined, situacao: "ATIVO", tamanho: 20 });

  const ficha = useFichaCliente(clienteId);
  const clienteEscolhido = ficha.data?.cliente;

  const campanhaEscolhida = useMemo(
    () => campanhas.data?.content.find((c) => c.id === campanhaId),
    [campanhas.data, campanhaId],
  );

  const registrar = useRegistrarCompra((resultado) => {
    // Cartão completo gera entrega; mandar para a ficha é onde o código do prêmio
    // aparece, que é o que o balcão precisa dizer ao cliente em seguida.
    if (resultado.cartaoCompletou && clienteId) {
      abrir({ nome: "cliente", id: clienteId });
      return;
    }
    aoVoltar();
  });

  const pronto = Boolean(clienteId && campanhaId && centavos && centavos > 0);

  return (
    <Tela
      titulo="Registrar compra"
      aoVoltar={aoVoltar}
      rodape={
        <Botao
          titulo="Registrar"
          largura="cheia"
          onPress={() => {
            if (!pronto) return;
            registrar.mutate({ campanhaId, clienteId, valorCompra: centavos! });
          }}
          desabilitado={!pronto}
          carregando={registrar.isPending}
          style={{ flex: 1 }}
        />
      }
    >
      {/* Passo 1 — quem */}
      <Secao titulo="Cliente">
        {clienteEscolhido ? (
          <Cartao destaque>
            <View style={estilos.topo}>
              <View style={{ flex: 1 }}>
                <Titulo nivel={3} numberOfLines={1}>
                  {clienteEscolhido.nome}
                </Titulo>
                <Apoio>
                  {formatarDocumento(clienteEscolhido.documento)} ·{" "}
                  {formatarTelefone(clienteEscolhido.telefone)}
                </Apoio>
              </View>
              <Botao
                titulo="Trocar"
                variante="sutil"
                compacto
                onPress={() => {
                  setClienteId("");
                  setBusca("");
                }}
              />
            </View>
          </Cartao>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Busca valor={busca} onChange={setBusca} placeholder="Nome, documento ou cartão" />

            {clientes.isPending ? (
              <Carregando />
            ) : clientes.data && clientes.data.content.length > 0 ? (
              clientes.data.content.map((cliente) => (
                <SeletorDeCliente
                  key={cliente.id}
                  cliente={cliente}
                  onPress={() => setClienteId(cliente.id)}
                />
              ))
            ) : busca.trim() ? (
              <Vazio
                icone="person-outline"
                titulo="Ninguém com esse termo"
                descricao="Confira o documento, ou cadastre a pessoa em Clientes."
              />
            ) : (
              <Apoio>Busque pelo nome, documento ou código do cartão.</Apoio>
            )}
          </View>
        )}
      </Secao>

      {/* Passo 2 — qual campanha */}
      <Secao titulo="Campanha">
        {campanhas.isPending ? (
          <Carregando />
        ) : campanhas.data && campanhas.data.content.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {campanhas.data.content.map((campanha) => (
              <SeletorDeCampanha
                key={campanha.id}
                campanha={campanha}
                escolhida={campanha.id === campanhaId}
                onPress={() => setCampanhaId(campanha.id)}
              />
            ))}
          </View>
        ) : (
          <Vazio
            icone="megaphone-outline"
            titulo="Nenhuma campanha no ar"
            descricao="Só campanha ativa aceita lançamento. Publique uma para começar a registrar."
          />
        )}
      </Secao>

      {/* Passo 3 — quanto */}
      <Secao titulo="Valor da compra">
        <CampoMoeda
          rotulo="Quanto o cliente gastou"
          centavos={centavos}
          onChange={setCentavos}
          dica={
            campanhaEscolhida
              ? campanhaEscolhida.regraEmUmaFrase
              : "Escolha a campanha para ver a regra."
          }
        />

        {campanhaEscolhida?.regra.valorMinimoCompra !== undefined &&
        centavos !== null &&
        centavos > 0 &&
        centavos < campanhaEscolhida.regra.valorMinimoCompra ? (
          <Alerta
            tom="atencao"
            titulo="Abaixo da compra mínima"
            descricao={`Esta campanha exige ${moeda(campanhaEscolhida.regra.valorMinimoCompra)}. O servidor vai recusar o lançamento.`}
          />
        ) : null}

        {campanhaEscolhida && centavos !== null && centavos > 0 ? (
          <Cartao>
            <Rotulo>O que o cliente ganha</Rotulo>
            <Previsao campanha={campanhaEscolhida} centavos={centavos} />
            <Divisor />
            {/* O número definitivo é o do servidor: ele conhece limite diário e o
                que o cliente já acumulou hoje. Aqui é estimativa, e diz que é. */}
            <Apoio>
              Estimativa. O valor final é calculado no servidor, que conhece o
              limite diário e o histórico do dia.
            </Apoio>
          </Cartao>
        ) : null}
      </Secao>
    </Tela>
  );
}

function Previsao({ campanha, centavos }: { campanha: Campanha; centavos: number }) {
  if (campanha.tipo === "SORTEIO") {
    const porCupom = campanha.regra.valorPorCupom ?? 0;
    const cupons = porCupom > 0 ? Math.floor(centavos / porCupom) : 0;
    return (
      <Linha rotulo="Cupons">
        <Texto>{plural(cupons, "cupom", "cupons")}</Texto>
      </Linha>
    );
  }

  return (
    <Linha rotulo="Selos">
      <Texto>1 selo</Texto>
    </Linha>
  );
}

function SeletorDeCliente({ cliente, onPress }: { cliente: Cliente; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Escolher ${cliente.nome}`}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <Cartao>
        <View style={estilos.topo}>
          <View style={{ flex: 1 }}>
            <Texto numberOfLines={1}>{cliente.nome}</Texto>
            <Apoio>
              {formatarDocumento(cliente.documento)} · {cliente.codigoCartao}
            </Apoio>
          </View>
          <Icone nome="chevron-forward" />
        </View>
      </Cartao>
    </Pressable>
  );
}

function SeletorDeCampanha({
  campanha,
  escolhida,
  onPress,
}: {
  campanha: Campanha;
  escolhida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: escolhida }}
      accessibilityLabel={campanha.nome}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <View
        style={[
          estilos.opcaoCampanha,
          escolhida
            ? { borderColor: colors.primary, backgroundColor: colors.accent, borderWidth: 2 }
            : { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={estilos.topo}>
          <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
            {campanha.nome}
          </Titulo>
          {escolhida ? <Icone nome="checkmark" cor={colors.primary} /> : null}
        </View>
        <Apoio>{ROTULO_TIPO_CAMPANHA[campanha.tipo]}</Apoio>
        <Apoio numberOfLines={2}>{campanha.regraEmUmaFrase}</Apoio>
        {campanha.premio?.estoqueBaixo ? <Selo tom="warning">Estoque baixo do prêmio</Selo> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  opcaoCampanha: {
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
