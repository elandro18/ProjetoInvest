import { errosPorCampo, type ApiError } from "@/src/lib/api-client";
import { dataIsoValida, formatarDataBr, hojeIso } from "@/src/lib/datas";
import { Decimal } from "@/src/lib/decimal";
import type {
  MovimentacaoApi,
  PosicaoApi,
} from "@/src/modules/movimentacoes/apresentacao";
import type { TipoMovimentacao } from "@/src/modules/posicao/tipos";

/**
 * Tipos e regras de forma da tela de movimentações (RN-014-5; UI_SPEC §7).
 *
 * Fica fora de `src/modules/**` de propósito: é forma de UI (rótulo, máscara,
 * mensagem) e não regra de negócio. A validação autoritativa continua nos
 * casos de uso do servidor; aqui só se antecipa o que dá para checar sem
 * duplicar o domínio. Os enums vêm do módulo — nunca são reescritos à mão.
 */

export type {
  MovimentacaoApi,
  PosicaoApi,
  TipoMovimentacao,
};

export const PAGE_SIZE_PADRAO = 20;
export const OBSERVACOES_MAX = 1000;
export const MOTIVO_MAX = 1000;
/** Tolerância monetária da RN-019 (R$ 0,01). */
export const TOLERANCIA_TOTAL = "0.01";
/** Tetos aceitos pelo contrato nas listas auxiliares. */
export const PAGE_SIZE_ATIVOS = 100;

export const TIPOS_MOVIMENTACAO: readonly TipoMovimentacao[] = [
  "COMPRA",
  "VENDA",
  "DIVIDENDO",
  "JUROS",
  "APLICACAO_RF",
  "RESGATE_RF",
  "TAXA",
];

/**
 * Tipos oferecidos no formulário. `APLICACAO_RF`/`RESGATE_RF` ficam de fora
 * porque a API os rejeita sem vínculo com `investimento_renda_fixa`
 * (PEND-017) — renda fixa é registrada no cadastro próprio.
 */
export const TIPOS_FORMULARIO: readonly TipoMovimentacao[] = [
  "COMPRA",
  "VENDA",
  "DIVIDENDO",
  "JUROS",
  "TAXA",
];

export const TIPOS_COM_QUANTIDADE: readonly TipoMovimentacao[] = ["COMPRA", "VENDA"];

const ROTULOS_TIPO: Readonly<Record<TipoMovimentacao, string>> = {
  COMPRA: "Compra",
  VENDA: "Venda",
  DIVIDENDO: "Dividendo",
  JUROS: "Juros",
  APLICACAO_RF: "Aplicação RF",
  RESGATE_RF: "Resgate RF",
  TAXA: "Taxa",
};

export const OPCOES_TIPO_FILTRO: readonly {
  readonly valor: TipoMovimentacao;
  readonly rotulo: string;
}[] = TIPOS_MOVIMENTACAO.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_TIPO[tipo] }));

export type OrdenacaoMovimentacao = "data" | "valorTotal" | "criadoEm";
export type DirecaoOrdem = "asc" | "desc";

export const OPCOES_ORDENACAO: readonly {
  readonly valor: `${OrdenacaoMovimentacao}:${DirecaoOrdem}`;
  readonly rotulo: string;
}[] = [
  { valor: "data:desc", rotulo: "Data (mais recente)" },
  { valor: "data:asc", rotulo: "Data (mais antiga)" },
  { valor: "valorTotal:desc", rotulo: "Valor total (maior)" },
  { valor: "valorTotal:asc", rotulo: "Valor total (menor)" },
];

export interface MetaMovimentacoes {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaMovimentacoesApi {
  readonly data: readonly MovimentacaoApi[];
  readonly meta: MetaMovimentacoes;
}

export interface RespostaCriacaoMovimentacaoApi {
  readonly movimentacao: MovimentacaoApi;
  readonly posicao: PosicaoApi;
}

export interface RespostaCancelamentoApi {
  readonly movimentacao: MovimentacaoApi;
  readonly posicao: PosicaoApi;
}

/** Ativo como a seleção da movimentação precisa vê-lo (API_CONTRACTS.md §3.1). */
export interface AtivoOpcaoApi {
  readonly id: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: { readonly codigo: string };
  readonly status: "ATIVO" | "INATIVO" | "EM_ANALISE";
}

export interface ListaAtivosOpcaoApi {
  readonly data: readonly AtivoOpcaoApi[];
}

/** Código da classe de renda fixa (DATA_MODEL.md §4.1). */
export const CLASSE_RENDA_FIXA = "RENDA_FIXA";

export interface ImpactoPosicaoNegativa {
  readonly quantidadeAtual: string;
  readonly quantidadeSolicitada: string;
  readonly quantidadeResultante: string;
}

/** Rótulo do tipo com texto sempre presente (UI_SPEC §18). */
export function rotuloTipo(tipo: TipoMovimentacao): string {
  return ROTULOS_TIPO[tipo] ?? tipo;
}

export function exigeQuantidade(tipo: TipoMovimentacao): boolean {
  return TIPOS_COM_QUANTIDADE.includes(tipo);
}

export function movimentacaoCancelada(item: MovimentacaoApi): boolean {
  return item.canceladaEm !== null;
}

/** Ativo elegível para lançamento manual: ativo e fora da classe renda fixa. */
export function ativoSelecionavel(ativo: AtivoOpcaoApi): boolean {
  return ativo.classe.codigo !== CLASSE_RENDA_FIXA && ativo.status === "ATIVO";
}

export function rotuloAtivo(ativo: AtivoOpcaoApi): string {
  return `${ativo.ticker} — ${ativo.nome}`;
}

// ---------------------------------------------------------------------------
// Números e datas
// ---------------------------------------------------------------------------

/**
 * Converte texto digitado em PT-BR (`"10.000,50"`) para decimal.
 *
 * Aceita também o formato do contrato (`"10000.50"`). Quando
 * `milharSemVirgula` é `true` (campos monetários), `"1.000"` é lido como mil —
 * nunca como 1,0. Retorna `null` quando não é um decimal válido.
 */
export function parseDecimalPtBr(texto: string, milharSemVirgula = false): Decimal | null {
  const bruto = texto.trim().replace(/\s/g, "");
  if (bruto === "") {
    return null;
  }

  let normalizado = bruto;
  if (bruto.includes(",")) {
    normalizado = bruto.replace(/\./g, "").replace(",", ".");
  } else if (milharSemVirgula && /^\d{1,3}(\.\d{3})+$/.test(bruto)) {
    normalizado = bruto.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) {
    return null;
  }

  const parsed = Decimal.parse(normalizado);
  return parsed.ok ? parsed.value : null;
}

/** Decimal do campo para a string do contrato (`casas` fixas) ou `null` se inválido. */
export function decimalParaApi(
  texto: string,
  casas: number,
  milharSemVirgula = false,
): string | null {
  const parsed = parseDecimalPtBr(texto, milharSemVirgula);
  return parsed === null ? null : parsed.toFixed(casas);
}

/** Dinheiro em BRL a partir da string decimal do contrato (`"1603.00"`). */
export function formatarMoeda(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const absoluto = parsed.value.abs().toFixed(2);
  const [inteiro, centavos] = absoluto.split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${parsed.value.isNegative() ? "-" : ""}R$ ${agrupado},${centavos}`;
}

/** Pré-preenchimento de campo monetário (`"1003.00"` → `"1.003,00"`). */
export function formatarNumeroDecimal(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return valor;
  }

  const [inteiro, centavos] = parsed.value.toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${agrupado},${centavos}`;
}

/** Quantidade com até 8 casas, sem zeros à direita (`"10.50000000"` → `"10,5"`). */
export function formatarQuantidade(valor: string | null): string {
  if (valor === null) {
    return "—";
  }

  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const texto = parsed.value.toFixed(8).replace(/\.?0+$/, "");
  return texto.replace(".", ",");
}

export function formatarData(iso: string | null, quandoAusente = "Não informado"): string {
  if (iso === null) {
    return quandoAusente;
  }
  if (!dataIsoValida(iso)) {
    return "Data inválida";
  }
  return formatarDataBr(iso);
}

/** Instante ISO-8601 em data/hora local para tooltip (UI_SPEC §1.2). */
export function formatarInstante(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return "Data inválida";
  }

  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${data.getFullYear()} ${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}

/** Hoje em UTC, no mesmo critério do servidor. */
export function hojeParaValidacao(): string {
  return hojeIso();
}

/** O servidor aceita até hoje + 1 dia (RN-014); o campo antecipa o limite. */
export function amanhaParaValidacao(hoje = hojeIso()): string {
  const ms = Date.parse(`${hoje}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Total previsto pela RN-019: `quantidade × valor unitário + custos`.
 *
 * Devolve `null` quando falta quantidade, valor unitário ou custos válidos —
 * nesse caso não há cálculo para comparar com o total digitado.
 */
export function calcularTotalPrevisto(
  quantidade: string,
  valorUnitario: string,
  custos: string,
): string | null {
  const qtd = parseDecimalPtBr(quantidade);
  const unitario = parseDecimalPtBr(valorUnitario, true);
  if (qtd === null || unitario === null) {
    return null;
  }

  const custo =
    custos.trim() === "" ? Decimal.zero(2) : parseDecimalPtBr(custos, true);
  if (custo === null) {
    return null;
  }

  return qtd.mul(unitario).add(custo).toFixed(2);
}

export interface DivergenciaTotal {
  readonly divergente: boolean;
  readonly diferenca: string;
}

/** Compara o total digitado com o previsto, na tolerância de R$ 0,01. */
export function compararTotal(
  valorTotal: string,
  totalCalculado: string,
): DivergenciaTotal | null {
  if (valorTotal.trim() === "") {
    return null;
  }

  const informado = parseDecimalPtBr(valorTotal, true);
  const calculado = Decimal.parse(totalCalculado);
  if (informado === null || !calculado.ok) {
    return null;
  }

  const diferenca = informado.sub(calculado.value).abs();
  return { divergente: diferenca.gt(TOLERANCIA_TOTAL), diferenca: diferenca.toFixed(2) };
}

// ---------------------------------------------------------------------------
// Validação de forma (espelha UI_SPEC §16 e ERROR_CATALOG §5)
// ---------------------------------------------------------------------------

export function validarDataMovimentacao(
  valor: string,
  limite = amanhaParaValidacao(),
): string | null {
  if (valor === "") {
    return "Informe a data da movimentação.";
  }
  if (!dataIsoValida(valor)) {
    return "Data inválida.";
  }
  if (valor > limite) {
    return "A data não pode ser superior a amanhã.";
  }
  return null;
}

export function validarQuantidadeMovimentacao(
  valor: string,
  obrigatoria: boolean,
): string | null {
  if (valor.trim() === "") {
    return obrigatoria ? "Informe a quantidade." : null;
  }
  const parsed = parseDecimalPtBr(valor);
  if (parsed === null) {
    return "Quantidade inválida.";
  }
  return parsed.isPositive() && !parsed.isZero()
    ? null
    : "A quantidade deve ser maior que zero.";
}

export function validarValorUnitario(
  valor: string,
  obrigatorio: boolean,
): string | null {
  if (valor.trim() === "") {
    return obrigatorio ? "Informe o valor unitário." : null;
  }
  const parsed = parseDecimalPtBr(valor, true);
  if (parsed === null) {
    return "Valor unitário inválido.";
  }
  return parsed.isPositive() && !parsed.isZero()
    ? null
    : "O valor unitário deve ser maior que zero.";
}

export function validarCustos(valor: string): string | null {
  if (valor.trim() === "") {
    return null;
  }
  const parsed = parseDecimalPtBr(valor, true);
  if (parsed === null) {
    return "Custos inválidos.";
  }
  return parsed.isNegative() ? "Os custos não podem ser negativos." : null;
}

export function validarValorTotalMovimentacao(valor: string): string | null {
  if (valor.trim() === "") {
    return "Informe o valor total.";
  }
  const parsed = parseDecimalPtBr(valor, true);
  if (parsed === null) {
    return "Valor total inválido.";
  }
  return parsed.isPositive() && !parsed.isZero()
    ? null
    : "O valor total deve ser maior que zero.";
}

/** Observação é obrigatória quando o total diverge do cálculo (RN-019). */
export function validarObservacoesMovimentacao(
  valor: string,
  divergente: boolean,
): string | null {
  if (valor.trim().length > OBSERVACOES_MAX) {
    return `As observações devem ter no máximo ${OBSERVACOES_MAX} caracteres.`;
  }
  if (divergente && valor.trim() === "") {
    return "Informe uma observação explicando a diferença entre o valor total e o calculado.";
  }
  return null;
}

export function validarMotivo(valor: string): string | null {
  const normalizado = valor.trim();
  if (normalizado === "") {
    return "Informe o motivo.";
  }
  if (normalizado.length > MOTIVO_MAX) {
    return `O motivo deve ter no máximo ${MOTIVO_MAX} caracteres.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Erros do envelope
// ---------------------------------------------------------------------------

/**
 * Converte o envelope no mapa de erros por campo (UI_SPEC §16).
 *
 * Os códigos MOV_* do catálogo nem sempre carregam `details.errors`; sem este
 * mapeamento o titular veria só um alerta genérico e não saberia o campo.
 */
export function mapaDeErrosMovimentacao(error: ApiError): Record<string, string> {
  switch (error.code) {
    case "MOV_DATA_FUTURA":
      return { data: error.message };
    case "MOV_ATIVO_INATIVO":
      return { ativoId: error.message };
    case "MOV_TIPO_INVALIDO":
      return { tipo: error.message };
    case "MOV_QTD_OBRIGATORIA":
      return { quantidade: error.message, valorUnitario: error.message };
    case "MOV_VALOR_INCONSISTENTE":
      return { observacoes: error.message };
    case "MOV_CANCELAMENTO_SEM_MOTIVO":
      return { motivo: error.message };
    default:
      return errosPorCampo(error);
  }
}

/** Impacto da posição negativa a partir de `details` (API_CONTRACTS.md §1.1). */
export function posicaoNegativaDoErro(error: ApiError): ImpactoPosicaoNegativa | null {
  if (error.code !== "MOV_POSICAO_NEGATIVA") {
    return null;
  }

  const atual = error.details?.quantidadeAtual;
  const solicitada = error.details?.quantidadeSolicitada;
  const resultante = error.details?.quantidadeResultante;

  if (
    typeof atual !== "string" ||
    typeof solicitada !== "string" ||
    typeof resultante !== "string"
  ) {
    return null;
  }

  return {
    quantidadeAtual: atual,
    quantidadeSolicitada: solicitada,
    quantidadeResultante: resultante,
  };
}

export function lerTraceId(error: ApiError): string | null {
  const valor = error.details?.traceId;
  return typeof valor === "string" ? valor : null;
}
