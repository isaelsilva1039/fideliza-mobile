import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
  Avatar,
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  Conteudo,
  Divisor,
  Folha,
  Linha,
  Secao,
  Selo,
  Seletor,
  SemPermissao,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { perfisAtribuiveis, pode } from "../constants/permissoes";
import { useCriarMembro, useEditarMembro, useEquipe } from "../hooks/use-queries";
import { errosPorCampo } from "../lib/api/errors";
import { desde, plural, telefone as formatarTelefone } from "../lib/format";
import { ROTULO_PERFIL, type Membro, type Perfil, type SituacaoUsuario } from "../services/contrato";
import { useUsuario } from "../stores/session";
import { spacing } from "../theme";

/**
 * A equipe.
 *
 * Os perfis oferecidos ao cadastrar vêm de `perfisAtribuiveis`: ninguém promove
 * outra pessoa ao próprio nível ou acima. Um administrador que pudesse criar donos
 * daria a si mesmo, pela porta dos fundos, o poder de criar empresas.
 */
export function Equipe() {
  const usuario = useUsuario();
  const consulta = useEquipe();

  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Membro | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  const permitido = pode(usuario, "equipe.gerenciar");

  if (!permitido) {
    return (
      <Tela titulo="Equipe">
        <SemPermissao />
      </Tela>
    );
  }

  return (
    <>
      <Tela
        titulo="Equipe"
        acoes={
          <View style={{ flexDirection: "row" }}>
            <BotaoIcone icone="person-add-outline" rotulo="Novo membro" onPress={() => setNovoAberto(true)} />
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
        <Conteudo
          consulta={consulta}
          vazio={(dados) => dados.length === 0}
          aoVazio={
            <Vazio
              icone="people-circle-outline"
              titulo="Só você por aqui"
              descricao="Cadastre quem atende o balcão para acompanhar os lançamentos por pessoa."
              acao={<Botao titulo="Cadastrar pessoa" icone="person-add-outline" onPress={() => setNovoAberto(true)} />}
            />
          }
        >
          {(equipe) => (
            <Secao titulo={plural(equipe.length, "pessoa", "pessoas")}>
              {equipe.map((membro) => (
                <CartaoDeMembro
                  key={membro.usuario.id}
                  membro={membro}
                  ehVoce={membro.usuario.id === usuario?.id}
                  aoEditar={() => setEditando(membro)}
                />
              ))}
            </Secao>
          )}
        </Conteudo>
      </Tela>

      <NovoMembroFolha visivel={novoAberto} aoFechar={() => setNovoAberto(false)} />
      <EdicaoMembroFolha membro={editando} aoFechar={() => setEditando(null)} />
      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

function CartaoDeMembro({
  membro,
  ehVoce,
  aoEditar,
}: {
  membro: Membro;
  ehVoce: boolean;
  aoEditar: () => void;
}) {
  const { usuario } = membro;
  const inativo = usuario.situacao === "INATIVO";

  return (
    <Cartao>
      <View style={estilos.topo}>
        <Avatar nome={usuario.nome} />
        <View style={{ flex: 1 }}>
          <Titulo nivel={3} numberOfLines={1}>
            {usuario.nome}
            {ehVoce ? " (você)" : ""}
          </Titulo>
          <Apoio numberOfLines={1}>{usuario.email}</Apoio>
        </View>
        <Selo tom={inativo ? "neutral" : usuario.perfil === "DONO" ? "brand" : "success"}>
          {inativo ? "Sem acesso" : ROTULO_PERFIL[usuario.perfil]}
        </Selo>
      </View>

      <Divisor />
      {usuario.telefone ? <Linha rotulo="Telefone">{formatarTelefone(usuario.telefone)}</Linha> : null}
      <Linha rotulo="Lançamentos no mês">{membro.lancamentosNoMes}</Linha>
      <Linha rotulo="Último acesso">
        {usuario.ultimoAcessoEm ? desde(usuario.ultimoAcessoEm) : "nunca entrou"}
      </Linha>

      {/* O dono não é editável pela tela de equipe: quem entra no time de uma
          empresa entra como administrador ou funcionário. */}
      {usuario.perfil !== "DONO" ? (
        <Botao titulo="Editar" variante="sutil" compacto icone="create-outline" onPress={aoEditar} />
      ) : null}
    </Cartao>
  );
}

/* -------------------------------------------------------------------------- */
/* Cadastro                                                                   */
/* -------------------------------------------------------------------------- */

function NovoMembroFolha({ visivel, aoFechar }: { visivel: boolean; aoFechar: () => void }) {
  const ator = useUsuario();
  const opcoes = perfisAtribuiveis(ator).map((perfil) => ({
    valor: perfil,
    rotulo: ROTULO_PERFIL[perfil],
    dica:
      perfil === "ADMINISTRADOR"
        ? "Faz tudo na empresa, menos criar outra empresa."
        : "Atende o balcão: registra compra e entrega prêmio.",
  }));

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState<"ADMINISTRADOR" | "FUNCIONARIO">("FUNCIONARIO");
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visivel) return;
    setNome("");
    setEmail("");
    setTelefone("");
    setPerfil("FUNCIONARIO");
    setErros({});
  }, [visivel]);

  const criar = useCriarMembro(aoFechar);

  const enviar = () => {
    const problemas: Record<string, string> = {};
    if (!nome.trim()) problemas.nome = "Informe o nome.";
    if (!email.trim().includes("@")) problemas.email = "Informe um e-mail válido.";

    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return;
    }

    criar.mutate(
      {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.replace(/\D/g, "") || undefined,
        perfil,
      },
      { onError: (erro) => setErros(errosPorCampo(erro)) },
    );
  };

  return (
    <Folha
      visivel={visivel}
      titulo="Nova pessoa"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Cancelar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
          <Botao titulo="Cadastrar" onPress={enviar} carregando={criar.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Campo
        rotulo="Nome"
        valor={nome}
        onChange={setNome}
        autoCapitalize="words"
        erro={erros.nome}
      />
      <Campo
        rotulo="E-mail"
        valor={email}
        onChange={setEmail}
        placeholder="pessoa@empresa.com"
        teclado="email-address"
        autoCapitalize="none"
        dica="É com ele que a pessoa entra no sistema."
        erro={erros.email}
      />
      <Campo
        rotulo="Telefone (opcional)"
        valor={telefone}
        onChange={(v) => setTelefone(formatarTelefone(v))}
        teclado="phone-pad"
        maxLength={16}
        erro={erros.telefone}
      />
      <Seletor
        rotulo="Perfil"
        opcoes={opcoes}
        valor={perfil}
        onChange={setPerfil}
        coluna
        erro={erros.perfil}
      />
    </Folha>
  );
}

function EdicaoMembroFolha({ membro, aoFechar }: { membro: Membro | null; aoFechar: () => void }) {
  const ator = useUsuario();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("FUNCIONARIO");
  const [situacao, setSituacao] = useState<SituacaoUsuario>("ATIVO");

  useEffect(() => {
    if (!membro) return;
    setNome(membro.usuario.nome);
    setTelefone(formatarTelefone(membro.usuario.telefone ?? ""));
    setPerfil(membro.usuario.perfil);
    setSituacao(membro.usuario.situacao);
  }, [membro]);

  const editar = useEditarMembro(aoFechar);

  const opcoesPerfil = perfisAtribuiveis(ator).map((valor) => ({
    valor: valor as Perfil,
    rotulo: ROTULO_PERFIL[valor],
  }));

  return (
    <Folha
      visivel={membro !== null}
      titulo="Editar pessoa"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Cancelar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
          <Botao
            titulo="Salvar"
            carregando={editar.isPending}
            onPress={() => {
              if (!membro) return;
              editar.mutate({
                id: membro.usuario.id,
                nome: nome.trim(),
                telefone: telefone.replace(/\D/g, "") || undefined,
                perfil,
                situacao,
              });
            }}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      {membro ? (
        <>
          <Campo rotulo="Nome" valor={nome} onChange={setNome} autoCapitalize="words" />
          <Campo
            rotulo="Telefone"
            valor={telefone}
            onChange={(v) => setTelefone(formatarTelefone(v))}
            teclado="phone-pad"
            maxLength={16}
          />
          <Campo rotulo="E-mail" valor={membro.usuario.email} onChange={() => undefined} editavel={false} />

          <Seletor rotulo="Perfil" opcoes={opcoesPerfil} valor={perfil} onChange={setPerfil} />

          <Seletor
            rotulo="Acesso"
            opcoes={[
              { valor: "ATIVO", rotulo: "Ativo" },
              {
                valor: "INATIVO",
                rotulo: "Sem acesso",
                dica: "Não entra mais no sistema. O histórico de lançamentos permanece.",
              },
            ]}
            valor={situacao}
            onChange={setSituacao}
            coluna
          />

          <Apoio>
            O e-mail não muda: é a identidade de acesso. Para trocar, desative esta
            pessoa e cadastre a nova.
          </Apoio>
        </>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
