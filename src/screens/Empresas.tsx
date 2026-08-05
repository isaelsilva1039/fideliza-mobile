import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Apoio,
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
  Texto,
  Titulo,
  Vazio,
} from "../components/ui";
import { MenuDaConta } from "../components/MenuDaConta";
import { pode } from "../constants/permissoes";
import { useCriarEmpresa, useEditarEmpresa, useTodasEmpresas } from "../hooks/use-queries";
import { errosPorCampo } from "../lib/api/errors";
import { data, documento as formatarDocumento, plural, telefone as formatarTelefone } from "../lib/format";
import type { Empresa, SituacaoEmpresa } from "../services/contrato";
import { useSession, useUsuario } from "../stores/session";
import { spacing } from "../theme";

/**
 * As empresas.
 *
 * Só o dono chega aqui. A listagem usa `todas=true`, que traz a plataforma
 * inteira — inclusive empresas que o dono não atende no dia a dia. Por isso a
 * empresa ativa aparece marcada: sem isso, é fácil editar a loja errada num
 * cadastro de nomes parecidos.
 */
export function Empresas() {
  const usuario = useUsuario();
  const empresaAtivaId = useSession((estado) => estado.session?.empresaAtivaId);

  const permitido = pode(usuario, "empresas.gerenciar");
  const consulta = useTodasEmpresas(permitido);

  const [novaAberta, setNovaAberta] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  if (!permitido) {
    return (
      <Tela titulo="Empresas">
        <SemPermissao />
      </Tela>
    );
  }

  return (
    <>
      <Tela
        titulo="Empresas"
        acoes={
          <View style={{ flexDirection: "row" }}>
            <BotaoIcone icone="add" rotulo="Nova empresa" onPress={() => setNovaAberta(true)} />
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
              icone="business-outline"
              titulo="Nenhuma empresa"
              descricao="Cadastre a primeira loja para começar a criar campanhas."
              acao={<Botao titulo="Nova empresa" icone="add" onPress={() => setNovaAberta(true)} />}
            />
          }
        >
          {(empresas) => (
            <Secao titulo={plural(empresas.length, "empresa", "empresas")}>
              {empresas.map((empresa) => (
                <CartaoDeEmpresa
                  key={empresa.id}
                  empresa={empresa}
                  ativa={empresa.id === empresaAtivaId}
                  aoEditar={() => setEditando(empresa)}
                />
              ))}
            </Secao>
          )}
        </Conteudo>
      </Tela>

      <NovaEmpresaFolha visivel={novaAberta} aoFechar={() => setNovaAberta(false)} />
      <EdicaoEmpresaFolha empresa={editando} aoFechar={() => setEditando(null)} />
      <MenuDaConta visivel={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}

function CartaoDeEmpresa({
  empresa,
  ativa,
  aoEditar,
}: {
  empresa: Empresa;
  ativa: boolean;
  aoEditar: () => void;
}) {
  const inativa = empresa.situacao === "INATIVA";

  return (
    <Cartao destaque={ativa}>
      <View style={estilos.topo}>
        <Titulo nivel={3} style={{ flex: 1 }} numberOfLines={2}>
          {empresa.nomeFantasia}
        </Titulo>
        {ativa ? <Selo tom="brand">Ativa agora</Selo> : null}
        {inativa ? <Selo tom="neutral">Desativada</Selo> : null}
      </View>

      {empresa.razaoSocial && empresa.razaoSocial !== empresa.nomeFantasia ? (
        <Apoio numberOfLines={1}>{empresa.razaoSocial}</Apoio>
      ) : null}

      <Divisor />
      <Linha rotulo="Documento">{formatarDocumento(empresa.documento)}</Linha>
      {empresa.telefone ? <Linha rotulo="Telefone">{formatarTelefone(empresa.telefone)}</Linha> : null}
      {empresa.email ? <Linha rotulo="E-mail">{empresa.email}</Linha> : null}
      {empresa.cidade || empresa.uf ? (
        <Linha rotulo="Cidade">{[empresa.cidade, empresa.uf].filter(Boolean).join(" · ")}</Linha>
      ) : null}
      <Linha rotulo="Cadastrada">{data(empresa.criadoEm)}</Linha>

      <Botao titulo="Editar" variante="sutil" compacto icone="create-outline" onPress={aoEditar} />
    </Cartao>
  );
}

/* -------------------------------------------------------------------------- */
/* Cadastro                                                                   */
/* -------------------------------------------------------------------------- */

function NovaEmpresaFolha({ visivel, aoFechar }: { visivel: boolean; aoFechar: () => void }) {
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visivel) return;
    setNomeFantasia("");
    setRazaoSocial("");
    setDocumento("");
    setTelefone("");
    setEmail("");
    setCidade("");
    setUf("");
    setErros({});
  }, [visivel]);

  const criar = useCriarEmpresa(aoFechar);

  const enviar = () => {
    const problemas: Record<string, string> = {};
    const digitos = documento.replace(/\D/g, "");

    if (!nomeFantasia.trim()) problemas.nomeFantasia = "Informe o nome da loja.";
    if (digitos.length !== 11 && digitos.length !== 14) {
      problemas.documento = "CPF tem 11 dígitos; CNPJ, 14.";
    }

    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return;
    }

    criar.mutate(
      {
        nomeFantasia: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim() || undefined,
        documento: digitos,
        telefone: telefone.replace(/\D/g, "") || undefined,
        email: email.trim() || undefined,
        cidade: cidade.trim() || undefined,
        uf: uf.trim().toUpperCase() || undefined,
      },
      { onError: (erro) => setErros(errosPorCampo(erro)) },
    );
  };

  return (
    <Folha
      visivel={visivel}
      titulo="Nova empresa"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Cancelar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
          <Botao titulo="Cadastrar" onPress={enviar} carregando={criar.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Campo
        rotulo="Nome da loja"
        valor={nomeFantasia}
        onChange={setNomeFantasia}
        placeholder="Açaí do Centro"
        autoCapitalize="words"
        erro={erros.nomeFantasia}
      />
      <Campo
        rotulo="Razão social (opcional)"
        valor={razaoSocial}
        onChange={setRazaoSocial}
        autoCapitalize="words"
        erro={erros.razaoSocial}
      />
      <Campo
        rotulo="CNPJ ou CPF"
        valor={documento}
        onChange={(v) => setDocumento(formatarDocumento(v))}
        placeholder="00.000.000/0001-00"
        teclado="number-pad"
        maxLength={18}
        erro={erros.documento}
      />
      <Campo
        rotulo="Telefone (opcional)"
        valor={telefone}
        onChange={(v) => setTelefone(formatarTelefone(v))}
        teclado="phone-pad"
        maxLength={16}
        erro={erros.telefone}
      />
      <Campo
        rotulo="E-mail (opcional)"
        valor={email}
        onChange={setEmail}
        teclado="email-address"
        autoCapitalize="none"
        erro={erros.email}
      />
      <Campo
        rotulo="Cidade (opcional)"
        valor={cidade}
        onChange={setCidade}
        autoCapitalize="words"
        erro={erros.cidade}
      />
      <Campo
        rotulo="UF (opcional)"
        valor={uf}
        onChange={(v) => setUf(v.replace(/[^A-Za-z]/g, "").slice(0, 2))}
        placeholder="MA"
        autoCapitalize="characters"
        maxLength={2}
        erro={erros.uf}
      />

      <Apoio>
        Você é vinculado automaticamente à empresa nova, e ela já aparece no seletor
        do menu da conta.
      </Apoio>
    </Folha>
  );
}

function EdicaoEmpresaFolha({ empresa, aoFechar }: { empresa: Empresa | null; aoFechar: () => void }) {
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [situacao, setSituacao] = useState<SituacaoEmpresa>("ATIVA");

  useEffect(() => {
    if (!empresa) return;
    setNomeFantasia(empresa.nomeFantasia);
    setRazaoSocial(empresa.razaoSocial ?? "");
    setTelefone(formatarTelefone(empresa.telefone ?? ""));
    setEmail(empresa.email ?? "");
    setCidade(empresa.cidade ?? "");
    setUf(empresa.uf ?? "");
    setSituacao(empresa.situacao);
  }, [empresa]);

  const editar = useEditarEmpresa(aoFechar);

  return (
    <Folha
      visivel={empresa !== null}
      titulo="Editar empresa"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao titulo="Cancelar" variante="secundario" onPress={aoFechar} style={{ flex: 1 }} />
          <Botao
            titulo="Salvar"
            carregando={editar.isPending}
            onPress={() => {
              if (!empresa) return;
              editar.mutate({
                id: empresa.id,
                nomeFantasia: nomeFantasia.trim(),
                razaoSocial: razaoSocial.trim() || undefined,
                telefone: telefone.replace(/\D/g, "") || undefined,
                email: email.trim() || undefined,
                cidade: cidade.trim() || undefined,
                uf: uf.trim().toUpperCase() || undefined,
                situacao,
              });
            }}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      {empresa ? (
        <>
          <Campo
            rotulo="Nome da loja"
            valor={nomeFantasia}
            onChange={setNomeFantasia}
            autoCapitalize="words"
          />
          <Campo
            rotulo="Razão social"
            valor={razaoSocial}
            onChange={setRazaoSocial}
            autoCapitalize="words"
          />
          <Campo
            rotulo="Documento"
            valor={formatarDocumento(empresa.documento)}
            onChange={() => undefined}
            editavel={false}
          />
          <Campo
            rotulo="Telefone"
            valor={telefone}
            onChange={(v) => setTelefone(formatarTelefone(v))}
            teclado="phone-pad"
            maxLength={16}
          />
          <Campo
            rotulo="E-mail"
            valor={email}
            onChange={setEmail}
            teclado="email-address"
            autoCapitalize="none"
          />
          <Campo rotulo="Cidade" valor={cidade} onChange={setCidade} autoCapitalize="words" />
          <Campo
            rotulo="UF"
            valor={uf}
            onChange={(v) => setUf(v.replace(/[^A-Za-z]/g, "").slice(0, 2))}
            autoCapitalize="characters"
            maxLength={2}
          />

          <Seletor
            rotulo="Situação"
            opcoes={[
              { valor: "ATIVA", rotulo: "Ativa" },
              {
                valor: "INATIVA",
                rotulo: "Desativada",
                dica: "Ninguém entra nem registra compra nela. Os dados ficam guardados.",
              },
            ]}
            valor={situacao}
            onChange={setSituacao}
            coluna
          />

          {situacao === "INATIVA" && empresa.situacao === "ATIVA" ? (
            <Texto>
              Desativar interrompe as campanhas no ar e impede novos lançamentos. Dá
              para reativar depois, aqui mesmo.
            </Texto>
          ) : null}
        </>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
});
