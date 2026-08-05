/**
 * O sistema de componentes, num ponto de entrada.
 *
 * As telas importam daqui (`from "../components/ui"`) e não dos arquivos
 * individuais: quando um componente se mudar de arquivo, nenhuma tela precisa
 * saber.
 */

export {
  Apoio,
  Avatar,
  Cartao,
  Divisor,
  Icone,
  Linha,
  Numero,
  Rotulo,
  Secao,
  Selo,
  Selos,
  Texto,
  Titulo,
} from "./base";

export { Botao, BotaoIcone, type VarianteBotao } from "./Botao";

export {
  Busca,
  Campo,
  CampoMoeda,
  Filtros,
  Interruptor,
  Seletor,
  type Opcao,
} from "./formulario";

export {
  Alerta,
  Carregando,
  CarregandoDiscreto,
  CartaoDeAviso,
  Conteudo,
  Erro,
  SemPermissao,
  Vazio,
} from "./estados";

export { Confirmacao, Folha } from "./Folha";
export { Paginacao } from "./Paginacao";
