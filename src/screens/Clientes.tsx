import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Botao,
  BotaoIcone,
  Busca,
  Campo,
  Cartao,
  Conteudo,
  Filtros,
  Folha,
  Paginacao,
  Selo,
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { pode } from "../constants/permissoes";
import { useClientes, useCriarCliente } from "../hooks/use-queries";
import { errosPorCampo } from "../lib/api/errors";
import { desde, documento as formatarDocumento, moeda, telefone as formatarTelefone } from "../lib/format";
import type { Cliente, SituacaoCliente } from "../services/contrato";
import { useNavegacao } from "../stores/navegacao";
import { useUsuario } from "../stores/session";
import { spacing } from "../theme";

/**
 * A listagem de clientes.
 *
 * A busca aceita nome, documento e código do cartão — é o que o balcão tem à mão
 * quando a pessoa chega. Filtro de situação começa vazio, mostrando ativos e
 * inativos: quem procura alguém que sumiu precisa achá-lo.
 */

const SITUACOES: Array<{ valor: SituacaoCliente; rotulo: string }> = [
  { valor: "ATIVO", rotulo: "Ativos" },
  { valor: "INATIVO", rotulo: "Inativos" },
];

export function Clientes() {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCliente[]>([]);
  const [pagina, setPagina] = useState(1);
  const [novoAberto, setNovoAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const usuario = useUsuario();
  const abrir = useNavegacao((estado) => estado.abrir);
  const podeGerenciar = pode(usuario, "clientes.gerenciar");

  const consulta = useClientes({
    busca: busca.trim() || undefined,
    // A API aceita uma situação só, não lista — então dois selecionados equivale
    // a nenhum, que é "todos".
    situacao: situacao.length === 1 ? situacao[0] : undefined,
    pagina,
    tamanho: 20,
  });

  return (
    <>
      <Tela
        titulo="Clientes"
        acoes={
          <View style={{ flexDirection: "row" }}>
            {/* Cadastrar cliente é trabalho de balcão: os três perfis fazem. */}
            <BotaoIcone icone="person-add-outline" rotulo="Novo cliente" onPress={() => setNovoAberto(true)} />
            <BotaoIcone
              icone="person-circle-outline"
              rotulo="Sua conta"
              onPress={() => setMenuAberto(true)}
            />
          </View>
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
            placeholder="Nome, documento ou cartão"
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
              icone="people-outline"
              titulo={busca ? "Ninguém com esse termo" : "Nenhum cliente ainda"}
              descricao={
                busca
                  ? "Confira o documento ou tente parte do nome."
                  : "Cadastre a primeira pessoa para começar a registrar compras."
              }
              acao={
                busca ? undefined : (
                  <Botao titulo="Cadastrar cliente" icone="person-add-outline" onPress={() => setNovoAberto(true)} />
                )
              }
            />
          }
        >
          {(dados) => (
            <View style={{ gap: spacing.sm }}>
              {dados.content.map((cliente) => (
                <ItemDeCliente
                  key={cliente.id}
                  cliente={cliente}
                  onPress={() => abrir({ nome: "cliente", id: cliente.id })}
                />
              ))}
              <Paginacao pagina={dados} onChange={setPagina} />
            </View>
          )}
        </Conteudo>
      </Tela>

      <NovoClienteFolha
        visivel={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        aoCriar={(cliente) => {
          setNovoAberto(false);
          // Vai direto para a ficha: quem cadastrou está com a pessoa na frente e
          // o passo seguinte é registrar a compra.
          abrir({ nome: "cliente", id: cliente.id });
        }}
        podeGerenciar={podeGerenciar}
      />

      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

function ItemDeCliente({ cliente, onPress }: { cliente: Cliente; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={cliente.nome}>
      <Cartao>
        <View style={estilos.topo}>
          <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={1}>
            {cliente.nome}
          </Titulo>
          {cliente.situacao === "INATIVO" ? <Selo tom="neutral">Inativo</Selo> : null}
        </View>
        <Apoio>
          {formatarDocumento(cliente.documento)} · {formatarTelefone(cliente.telefone)}
        </Apoio>
        <View style={estilos.rodape}>
          <Texto style={{ fontVariant: ["tabular-nums"] }}>{moeda(cliente.totalGasto)}</Texto>
          <Apoio>{cliente.codigoCartao}</Apoio>
        </View>
        <Apoio>Última atividade {desde(cliente.ultimaAtividadeEm)}</Apoio>
      </Cartao>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Cadastro                                                                   */
/* -------------------------------------------------------------------------- */

export function NovoClienteFolha({
  visivel,
  aoFechar,
  aoCriar,
  podeGerenciar,
}: {
  visivel: boolean;
  aoFechar: () => void;
  aoCriar: (cliente: Cliente) => void;
  podeGerenciar: boolean;
}) {
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  const limpar = () => {
    setNome("");
    setDocumento("");
    setTelefone("");
    setEmail("");
    setErros({});
  };

  const criar = useCriarCliente((cliente) => {
    limpar();
    aoCriar(cliente);
  });

  const enviar = () => {
    const problemas: Record<string, string> = {};
    const digitosDoc = documento.replace(/\D/g, "");
    const digitosTel = telefone.replace(/\D/g, "");

    if (!nome.trim()) problemas.nome = "Informe o nome.";
    if (digitosDoc.length !== 11 && digitosDoc.length !== 14) {
      problemas.documento = "CPF tem 11 dígitos; CNPJ, 14.";
    }
    if (digitosTel.length < 10) problemas.telefone = "Informe DDD e número.";

    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return;
    }

    criar.mutate(
      {
        nome: nome.trim(),
        documento: digitosDoc,
        telefone: digitosTel,
        email: email.trim() || undefined,
      },
      // O servidor tem a última palavra: documento repetido só ele sabe.
      { onError: (erro) => setErros(errosPorCampo(erro)) },
    );
  };

  return (
    <Folha
      visivel={visivel}
      titulo="Novo cliente"
      aoFechar={() => {
        limpar();
        aoFechar();
      }}
      rodape={
        <Botao
          titulo="Cadastrar"
          largura="cheia"
          onPress={enviar}
          carregando={criar.isPending}
          style={{ flex: 1 }}
        />
      }
    >
      {!podeGerenciar ? (
        <Apoio>
          Você pode cadastrar clientes novos. Editar cadastro existente é de outro
          perfil.
        </Apoio>
      ) : null}

      <Campo
        rotulo="Nome"
        valor={nome}
        onChange={setNome}
        placeholder="Como está no documento"
        autoCapitalize="words"
        erro={erros.nome}
      />
      <Campo
        rotulo="CPF ou CNPJ"
        valor={documento}
        onChange={(v) => setDocumento(formatarDocumento(v))}
        placeholder="000.000.000-00"
        teclado="number-pad"
        maxLength={18}
        erro={erros.documento}
      />
      <Campo
        rotulo="Telefone"
        valor={telefone}
        onChange={(v) => setTelefone(formatarTelefone(v))}
        placeholder="(98) 99123-4567"
        teclado="phone-pad"
        maxLength={16}
        dica="É para onde vai o código quando o cliente consultar o cartão."
        erro={erros.telefone}
      />
      <Campo
        rotulo="E-mail (opcional)"
        valor={email}
        onChange={setEmail}
        placeholder="cliente@email.com"
        teclado="email-address"
        autoCapitalize="none"
        erro={erros.email}
      />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  rodape: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
});
