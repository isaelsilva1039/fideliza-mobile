import { useEffect, useState } from "react";
import { View } from "react-native";

import { Tela } from "../components/Tela";
import {
  Alerta,
  Apoio,
  Botao,
  Campo,
  CampoMoeda,
  Carregando,
  Seletor,
  Secao,
  SemPermissao,
  Titulo,
} from "../components/ui";
import { pode } from "../constants/permissoes";
import { useCampanha, useCriarCampanha, useEditarCampanha } from "../hooks/use-queries";
import { centavosDeTexto } from "../lib/format";
import type { NovaCampanha } from "../services";
import type { TipoCampanha } from "../services/contrato";
import { useUsuario } from "../stores/session";
import { spacing } from "../theme";

/**
 * Criar e editar campanha.
 *
 * A mesma tela para os dois casos: os campos são idênticos, e duplicá-la faria
 * uma das cópias divergir na primeira mudança de regra.
 *
 * Datas são texto no formato `AAAA-MM-DD` em vez de seletor nativo. Um
 * `DateTimePicker` é módulo nativo, e o app precisa rodar no Expo Go da loja; o
 * campo de texto com máscara é menos elegante mas funciona em todo aparelho — e a
 * conversão para ISO, que é o que a API espera, fica explícita e conferível.
 */

const TIPOS: Array<{ valor: TipoCampanha; rotulo: string; dica: string }> = [
  {
    valor: "CARTAO_FIDELIDADE",
    rotulo: "Cartão fidelidade",
    dica: "O cliente junta selos e ganha ao completar.",
  },
  {
    valor: "SORTEIO",
    rotulo: "Sorteio",
    dica: "Cada valor gasto vira cupom; um ganhador é sorteado.",
  },
];

interface Formulario {
  nome: string;
  descricao: string;
  tipo: TipoCampanha;
  iniciaEm: string;
  terminaEm: string;
  sorteiaEm: string;
  selosNecessarios: string;
  valorPorCupom: number | null;
  valorMinimoCompra: number | null;
  limiteTotalCupons: string;
  limiteDiarioCliente: string;
  nomePremio: string;
  descricaoPremio: string;
  quantidadePremio: string;
  instrucoesRetirada: string;
}

const VAZIO: Formulario = {
  nome: "",
  descricao: "",
  tipo: "CARTAO_FIDELIDADE",
  iniciaEm: hojeIso(),
  terminaEm: "",
  sorteiaEm: "",
  selosNecessarios: "10",
  valorPorCupom: 1000,
  valorMinimoCompra: null,
  limiteTotalCupons: "",
  limiteDiarioCliente: "",
  nomePremio: "",
  descricaoPremio: "",
  quantidadePremio: "1",
  instrucoesRetirada: "",
};

function hojeIso(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

/** `"2026-08-04"` para ISO completo. Devolve `null` quando a data não existe. */
function paraIsoCompleto(texto: string, fimDoDia = false): string | null {
  const match = texto.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, ano, mes, dia] = match;
  const data = new Date(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    fimDoDia ? 23 : 0,
    fimDoDia ? 59 : 0,
    fimDoDia ? 59 : 0,
  );

  // Recusa "2026-02-31": o `Date` aceitaria e rolaria para março, e a campanha
  // terminaria num dia que ninguém digitou.
  if (data.getMonth() !== Number(mes) - 1 || data.getDate() !== Number(dia)) return null;

  return data.toISOString();
}

export function CampanhaForm({ id, aoVoltar }: { id?: string; aoVoltar: () => void }) {
  const usuario = useUsuario();
  const editando = Boolean(id);

  const consulta = useCampanha(id ?? "");
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});

  // Ao editar, preenche a partir do que o servidor tem. Roda uma vez por campanha
  // carregada — mexer no formulário depois não é sobrescrito por um refetch.
  const carregada = editando ? consulta.data?.campanha : undefined;
  useEffect(() => {
    if (!carregada) return;

    setForm({
      nome: carregada.nome,
      descricao: carregada.descricao,
      tipo: carregada.tipo,
      iniciaEm: carregada.iniciaEm.slice(0, 10),
      terminaEm: carregada.terminaEm.slice(0, 10),
      sorteiaEm: carregada.sorteiaEm?.slice(0, 10) ?? "",
      selosNecessarios: String(carregada.regra.selosNecessarios ?? 10),
      valorPorCupom: carregada.regra.valorPorCupom ?? 1000,
      valorMinimoCompra: carregada.regra.valorMinimoCompra ?? null,
      limiteTotalCupons: carregada.regra.limiteTotalCupons?.toString() ?? "",
      limiteDiarioCliente: carregada.regra.limiteDiarioCliente?.toString() ?? "",
      nomePremio: carregada.premios[0]?.nome ?? "",
      descricaoPremio: carregada.premios[0]?.descricao ?? "",
      quantidadePremio: String(carregada.premios[0]?.quantidadeTotal ?? 1),
      instrucoesRetirada: carregada.premios[0]?.instrucoesRetirada ?? "",
    });
  }, [carregada]);

  const criar = useCriarCampanha(() => aoVoltar());
  const editar = useEditarCampanha(() => aoVoltar());

  if (!pode(usuario, "campanhas.gerenciar")) {
    return (
      <Tela titulo="Campanha" aoVoltar={aoVoltar}>
        <SemPermissao />
      </Tela>
    );
  }

  if (editando && consulta.isPending) {
    return (
      <Tela titulo="Editar campanha" aoVoltar={aoVoltar}>
        <Carregando />
      </Tela>
    );
  }

  const atualizar = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) => {
    setForm((atual) => ({ ...atual, [chave]: valor }));
    setErros((atual) => {
      const { [chave as string]: _, ...resto } = atual;
      return resto;
    });
  };

  const ehSorteio = form.tipo === "SORTEIO";

  const montar = (publicar: boolean): NovaCampanha | null => {
    const problemas: Record<string, string> = {};

    if (!form.nome.trim()) problemas.nome = "Dê um nome à campanha.";
    if (!form.nomePremio.trim()) problemas.nomePremio = "Informe o prêmio.";

    const inicia = paraIsoCompleto(form.iniciaEm);
    if (!inicia) problemas.iniciaEm = "Use o formato AAAA-MM-DD.";

    const termina = paraIsoCompleto(form.terminaEm, true);
    if (!termina) problemas.terminaEm = "Use o formato AAAA-MM-DD.";

    if (inicia && termina && new Date(termina) <= new Date(inicia)) {
      problemas.terminaEm = "O fim tem de ser depois do começo.";
    }

    let sorteia: string | undefined;
    if (ehSorteio && form.sorteiaEm.trim()) {
      const convertida = paraIsoCompleto(form.sorteiaEm, true);
      if (!convertida) problemas.sorteiaEm = "Use o formato AAAA-MM-DD.";
      else sorteia = convertida;
    }

    if (ehSorteio) {
      if (form.valorPorCupom === null || form.valorPorCupom <= 0) {
        problemas.valorPorCupom = "Informe quanto vale um cupom.";
      }
    } else {
      const selos = Number(form.selosNecessarios);
      if (!Number.isInteger(selos) || selos < 1) {
        problemas.selosNecessarios = "Informe um número inteiro de selos.";
      }
    }

    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return null;
    }

    const numeroOuUndefined = (texto: string) => {
      const valor = Number(texto.trim());
      return texto.trim() && Number.isFinite(valor) && valor > 0 ? valor : undefined;
    };

    return {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      iniciaEm: inicia!,
      terminaEm: termina!,
      sorteiaEm: sorteia,
      valorMinimoCompra: form.valorMinimoCompra ?? undefined,
      selosNecessarios: ehSorteio ? undefined : Number(form.selosNecessarios),
      valorPorCupom: ehSorteio ? (form.valorPorCupom ?? undefined) : undefined,
      limiteTotalCupons: ehSorteio ? numeroOuUndefined(form.limiteTotalCupons) : undefined,
      limiteDiarioCliente: numeroOuUndefined(form.limiteDiarioCliente),
      premios: [{
        nome: form.nomePremio.trim(),
        descricao: form.descricaoPremio.trim() || undefined,
        quantidade: numeroOuUndefined(form.quantidadePremio) ?? 1,
        instrucoesRetirada: form.instrucoesRetirada.trim() || undefined,
      }],
      publicar,
    };
  };

  const enviar = (publicar: boolean) => {
    const corpo = montar(publicar);
    if (!corpo) return;

    if (editando && id) editar.mutate({ id, ...corpo });
    else criar.mutate(corpo);
  };

  const salvando = criar.isPending || editar.isPending;

  return (
    <Tela
      titulo={editando ? "Editar campanha" : "Nova campanha"}
      aoVoltar={aoVoltar}
      rodape={
        <>
          {!editando ? (
            <Botao
              titulo="Salvar rascunho"
              variante="secundario"
              onPress={() => enviar(false)}
              carregando={salvando}
              style={{ flex: 1 }}
            />
          ) : null}
          <Botao
            titulo={editando ? "Salvar" : "Publicar"}
            onPress={() => enviar(true)}
            carregando={salvando}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Secao titulo="O básico">
        <Campo
          rotulo="Nome"
          valor={form.nome}
          onChange={(v) => atualizar("nome", v)}
          placeholder="Clube do Açaí"
          erro={erros.nome}
        />
        <Campo
          rotulo="Descrição"
          valor={form.descricao}
          onChange={(v) => atualizar("descricao", v)}
          placeholder="O que o cliente precisa saber"
          multilinha
          erro={erros.descricao}
        />
      </Secao>

      <Secao titulo="Tipo">
        {editando ? (
          <Alerta
            tom="info"
            titulo="O tipo não muda depois de criada"
            descricao="Selo e cupom são contados de formas diferentes; trocar invalidaria o que os clientes já acumularam."
          />
        ) : null}
        <Seletor
          opcoes={TIPOS}
          valor={form.tipo}
          onChange={(v) => atualizar("tipo", v)}
          coluna
          erro={erros.tipo}
        />
      </Secao>

      <Secao titulo="Regra">
        {ehSorteio ? (
          <>
            <CampoMoeda
              rotulo="Valor por cupom"
              centavos={form.valorPorCupom}
              onChange={(v) => atualizar("valorPorCupom", v)}
              dica="A cada esse valor gasto, o cliente ganha um cupom."
              erro={erros.valorPorCupom}
            />
            <Campo
              rotulo="Limite total de cupons (opcional)"
              valor={form.limiteTotalCupons}
              onChange={(v) => atualizar("limiteTotalCupons", v.replace(/\D/g, ""))}
              teclado="number-pad"
              dica="Ao atingir esse total, a campanha para de aceitar novos cupons."
              erro={erros.limiteTotalCupons}
            />
          </>
        ) : (
          <Campo
            rotulo="Selos para completar"
            valor={form.selosNecessarios}
            onChange={(v) => atualizar("selosNecessarios", v.replace(/\D/g, ""))}
            teclado="number-pad"
            dica="Quantos selos o cliente junta antes de ganhar o prêmio."
            erro={erros.selosNecessarios}
          />
        )}

        <CampoMoeda
          rotulo="Compra mínima (opcional)"
          centavos={form.valorMinimoCompra}
          onChange={(v) => atualizar("valorMinimoCompra", v)}
          dica="Abaixo disso a compra não gera benefício. Deixe vazio para não exigir."
          erro={erros.valorMinimoCompra}
        />

        <Campo
          rotulo="Limite por cliente por dia (opcional)"
          valor={form.limiteDiarioCliente}
          onChange={(v) => atualizar("limiteDiarioCliente", v.replace(/\D/g, ""))}
          teclado="number-pad"
          dica="Evita que a mesma pessoa acumule muitas vezes no mesmo dia."
          erro={erros.limiteDiarioCliente}
        />
      </Secao>

      <Secao titulo="Prazo">
        <Campo
          rotulo="Começa em"
          valor={form.iniciaEm}
          onChange={(v) => atualizar("iniciaEm", v)}
          placeholder="AAAA-MM-DD"
          teclado="numbers-and-punctuation"
          maxLength={10}
          erro={erros.iniciaEm}
        />
        <Campo
          rotulo="Termina em"
          valor={form.terminaEm}
          onChange={(v) => atualizar("terminaEm", v)}
          placeholder="AAAA-MM-DD"
          teclado="numbers-and-punctuation"
          maxLength={10}
          erro={erros.terminaEm}
        />
        {ehSorteio ? (
          <Campo
            rotulo="Sorteia em (opcional)"
            valor={form.sorteiaEm}
            onChange={(v) => atualizar("sorteiaEm", v)}
            placeholder="AAAA-MM-DD"
            teclado="numbers-and-punctuation"
            maxLength={10}
            dica="A data prometida ao cliente. O sorteio em si é feito por você, depois de encerrar."
            erro={erros.sorteiaEm}
          />
        ) : null}
      </Secao>

      <Secao titulo="Prêmio">
        <Campo
          rotulo="O que o cliente ganha"
          valor={form.nomePremio}
          onChange={(v) => atualizar("nomePremio", v)}
          placeholder="Açaí 500 ml grátis"
          erro={erros.nomePremio}
        />
        <Campo
          rotulo="Detalhes (opcional)"
          valor={form.descricaoPremio}
          onChange={(v) => atualizar("descricaoPremio", v)}
          multilinha
          erro={erros.descricaoPremio}
        />
        <Campo
          rotulo="Quantidade disponível"
          valor={form.quantidadePremio}
          onChange={(v) => atualizar("quantidadePremio", v.replace(/\D/g, ""))}
          teclado="number-pad"
          erro={erros.quantidadePremio}
        />
        <Campo
          rotulo="Como retirar (opcional)"
          valor={form.instrucoesRetirada}
          onChange={(v) => atualizar("instrucoesRetirada", v)}
          placeholder="Retirada no balcão, com documento com foto."
          multilinha
          erro={erros.instrucoesRetirada}
        />
      </Secao>

      <View style={{ paddingBottom: spacing.xl }}>
        <Apoio>
          {editando
            ? "As alterações valem para os próximos lançamentos. O que os clientes já acumularam não muda."
            : "Publicar deixa a campanha valendo agora. Rascunho fica guardada até você publicar."}
        </Apoio>
      </View>
    </Tela>
  );
}
