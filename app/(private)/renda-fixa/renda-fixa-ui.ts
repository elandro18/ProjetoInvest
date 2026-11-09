import type {
  AlertaRendaFixa,
  SeveridadeAlerta,
  TipoAlertaRendaFixa,
} from "@/src/modules/renda-fixa/alertas";
import type { RendaFixaApi } from "@/src/modules/renda-fixa/apresentacao";
import { dataIsoValida, formatarDataBr, hojeIso } from "@/src/modules/renda-fixa/datas";
import {
  PRODUTOS_COM_FGC,
  type DirecaoOrdem,
  type IndexadorRendaFixa,
  type LiquidezRendaFixa,
  type OrdenacaoRendaFixa,
  type ProdutoRendaFixa,
  type StatusSaldo,
} from "@/src/modules/renda-fixa/repositorio";
import { errosPorCampo, type ApiError } from "@/src/lib/api-client";
import { Decimal } from "@/src/lib/decimal";

/**
 * Tipos e regras de forma da tela de renda fixa (RN-057-4; UI_SPEC §8).
 *
 * Fica fora de `src/modules/**` de propósito: é forma de UI (rótulo, máscara,
 * mensagem) e não regra de negócio. A validação autoritativa continua nos casos
 * de uso do servidor; aqui só se antecipa o que dá para checar sem duplicar o
 * domínio. Os enums vêm do port do módulo — nunca são reescritos à mão.
 */

export type {
  AlertaRendaFixa,
  DirecaoOrdem,
  IndexadorRendaFixa,
  LiquidezRendaFixa,
  OrdenacaoRendaFixa,
  ProdutoRendaFixa,
  RendaFixaApi,
  SeveridadeAlerta,
  StatusSaldo,
  TipoAlertaRendaFixa,
};

export const PAGE_SIZE_PADRAO = 20;
/** Teto aceito pelo contrato (API_CONTRACTS.md §6.1) — usado no filtro por alerta. */
export const PAGE_SIZE_MAXIMO = 100;

export const INSTITUICAO_MIN = 2;
export const INSTITUICAO_MAX = 120;
export const OBSERVACOES_MAX = 1000;
export const TAXA_MINIMA = 0;
export const TAXA_MAXIMA = 100;

export interface MetaListaRendaFixa {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaRendaFixaApi {
  readonly data: readonly RendaFixaApi[];
  readonly meta: MetaListaRendaFixa;
}

export interface RespostaAlertasApi {
  readonly alertas: readonly AlertaRendaFixa[];
}

export const OPCOES_PRODUTO: readonly {
  readonly valor: ProdutoRendaFixa;
  readonly rotulo: string;
}[] = [
  { valor: "TESOURO_SELIC", rotulo: "Tesouro Selic" },
  { valor: "TESOURO_IPCA", rotulo: "Tesouro IPCA+" },
  { valor: "TESOURO_PREFIXADO", rotulo: "Tesouro Prefixado" },
  { valor: "CDB", rotulo: "CDB" },
  { valor: "LCI", rotulo: "LCI" },
  { valor: "LCA", rotulo: "LCA" },
  { valor: "DEBENTURE", rotulo: "Debênture" },
  { valor: "OUTRO", rotulo: "Outro" },
];

export const OPCOES_INDEXADOR: readonly {
  readonly valor: IndexadorRendaFixa;
  readonly rotulo: string;
}[] = [
  { valor: "PRE", rotulo: "Pré-fixado" },
  { valor: "POS_CDI", rotulo: "Pós-CDI" },
  { valor: "IPCA", rotulo: "IPCA" },
  { valor: "SELIC", rotulo: "Selic" },
  { valor: "OUTRO", rotulo: "Outro" },
];

export const OPCOES_LIQUIDEZ: readonly {
  readonly valor: LiquidezRendaFixa;
  readonly rotulo: string;
}[] = [
  { valor: "DIARIA", rotulo: "Diária" },
  { valor: "NO_VENCIMENTO", rotulo: "No vencimento" },
  { valor: "PRAZO", rotulo: "No prazo" },
];

export const OPCOES_STATUS_SALDO: readonly {
  readonly valor: StatusSaldo;
  readonly rotulo: string;
}[] = [
  { valor: "INFORMADO", rotulo: "Informado" },
  { valor: "ESTIMADO", rotulo: "Estimado" },
  { valor: "CONFIRMADO", rotulo: "Confirmado" },
];

export const OPCOES_ORDENACAO: readonly {
  readonly valor: `${OrdenacaoRendaFixa}:${DirecaoOrdem}`;
  readonly rotulo: string;
}[] = [
  { valor: "vencimento:asc", rotulo: "Vencimento (mais próximo)" },
  { valor: "vencimento:desc", rotulo: "Vencimento (mais distante)" },
  { valor: "instituicao:asc", rotulo: "Instituição (A–Z)" },
  { valor: "instituicao:desc", rotulo: "Instituição (Z–A)" },
  { valor: "produto:asc", rotulo: "Produto (A–Z)" },
  { valor: "produto:desc", rotulo: "Produto (Z–A)" },
  { valor: "dataAplicacao:desc", rotulo: "Aplicação (mais recente)" },
  { valor: "dataAplicacao:asc", rotulo: "Aplicação (mais antiga)" },
  { valor: "saldoAtual:desc", rotulo: "Saldo (maior)" },
  { valor: "saldoAtual:asc", rotulo: "Saldo (menor)" },
  { valor: "criadoEm:desc", rotulo: "Cadastro (mais recente)" },
  { valor: "criadoEm:asc", rotulo: "Cadastro (mais antigo)" },
];

const ROTULOS_PRODUTO: Readonly<Record<ProdutoRendaFixa, string>> = {
  TESOURO_SELIC: "Tesouro Selic",
  TESOURO_IPCA: "Tesouro IPCA+",
  TESOURO_PREFIXADO: "Tesouro Prefixado",
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  DEBENTURE: "Debênture",
  OUTRO: "Outro",
};

const ROTULOS_INDEXADOR: Readonly<Record<IndexadorRendaFixa, string>> = {
  PRE: "Pré-fixado",
  POS_CDI: "Pós-CDI",
  IPCA: "IPCA",
  SELIC: "Selic",
  OUTRO: "Outro",
};

const ROTULOS_LIQUIDEZ: Readonly<Record<LiquidezRendaFixa, string>> = {
  DIARIA: "Diária",
  NO_VENCIMENTO: "No vencimento",
  PRAZO: "No prazo",
};

const ROTULOS_STATUS_SALDO: Readonly<Record<StatusSaldo, string>> = {
  INFORMADO: "Informado",
  ESTIMADO: "Estimado",
  CONFIRMADO: "Confirmado",
};

const ROTULOS_SEVERIDADE: Readonly<Record<SeveridadeAlerta, string>> = {
  INFO: "Informação",
  ATENCAO: "Atenção",
  CRITICO: "Crítico",
};

const ROTULOS_TIPO_ALERTA: Readonly<Record<TipoAlertaRendaFixa, string>> = {
  VENCIMENTO_PROXIMO: "Vencimento próximo",
  CARENCIA: "Carência",
  SEM_LIQUIDEZ: "Sem liquidez diária",
  CONCENTRACAO_INSTITUICAO: "Concentração por instituição",
  LIMITE_FGC: "Limite de FGC",
};

export const TONS_STATUS_SALDO: Readonly<
  Record<StatusSaldo, "neutral" | "warning" | "success">
> = {
  INFORMADO: "neutral",
  ESTIMADO: "warning",
  CONFIRMADO: "success",
};

export const TONS_SEVERIDADE: Readonly<Record<SeveridadeAlerta, "info" | "warning" | "error">> = {
  INFO: "info",
  ATENCAO: "warning",
  CRITICO: "error",
};

const ORDEM_SEVERIDADE: Readonly<Record<SeveridadeAlerta, number>> = {
  CRITICO: 0,
  ATENCAO: 1,
  INFO: 2,
};

/** Cobertura do FGC derivada do produto (RN-057; API_CONTRACTS.md §6.2). */
export function derivarCoberturaFgc(produto: ProdutoRendaFixa): boolean {
  return PRODUTOS_COM_FGC.includes(produto);
}

export function rotuloProduto(produto: ProdutoRendaFixa): string {
  return ROTULOS_PRODUTO[produto] ?? produto;
}

export function rotuloIndexador(indexador: IndexadorRendaFixa): string {
  return ROTULOS_INDEXADOR[indexador] ?? indexador;
}

export function rotuloLiquidez(liquidez: LiquidezRendaFixa): string {
  return ROTULOS_LIQUIDEZ[liquidez] ?? liquidez;
}

export function rotuloStatusSaldo(status: StatusSaldo): string {
  return ROTULOS_STATUS_SALDO[status] ?? status;
}

export function rotuloSeveridade(severidade: SeveridadeAlerta): string {
  return ROTULOS_SEVERIDADE[severidade] ?? severidade;
}

export function rotuloTipoAlerta(tipo: TipoAlertaRendaFixa): string {
  return ROTULOS_TIPO_ALERTA[tipo] ?? tipo;
}

// ---------------------------------------------------------------------------
// Números e datas
// ---------------------------------------------------------------------------

/**
 * Converte texto digitado em PT-BR (`"10.000,50"`) para decimal.
 *
 * Aceita também o formato do contrato (`"10000.50"`). Quando
 * `milharSemVirgula` é `true` (campos monetários), `"1.000"` é lido como mil —
 * nunca como 1,0. Retorna `null` quando não é um decimal válido — nunca lança
 * para a tela continuar utilizável.
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

/** Dinheiro em BRL a partir da string decimal do contrato (`"10450.00"`). */
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

/** Percentual com até 2 casas e sem zeros à direita (`"12.500000"` → `"12,5%"`). */
export function formatarPercentual(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const texto = parsed.value
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${texto}%`;
}

/** Pré-preenchimento de campo monetário (`"10450.00"` → `"10.450,00"`). */
export function formatarNumeroDecimal(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return valor;
  }

  const [inteiro, centavos] = parsed.value.toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${agrupado},${centavos}`;
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

/** Data de hoje em UTC, no mesmo critério do servidor. */
export function hojeParaValidacao(): string {
  return hojeIso();
}

// ---------------------------------------------------------------------------
// Validação de forma (espelha UI_SPEC §16 e ERROR_CATALOG §6)
// ---------------------------------------------------------------------------

export function validarInstituicao(valor: string): string | null {
  const normalizado = valor.trim();
  if (normalizado === "") {
    return "Informe a instituição.";
  }
  if (normalizado.length < INSTITUICAO_MIN || normalizado.length > INSTITUICAO_MAX) {
    return `A instituição deve ter entre ${INSTITUICAO_MIN} e ${INSTITUICAO_MAX} caracteres.`;
  }
  return null;
}

export function validarTaxaRendaFixa(valor: string): string | null {
  if (valor.trim() === "") {
    return "Informe a taxa.";
  }
  const parsed = parseDecimalPtBr(valor);
  if (parsed === null) {
    return "Taxa inválida.";
  }
  if (parsed.lt(String(TAXA_MINIMA)) || parsed.gt(String(TAXA_MAXIMA))) {
    return `A taxa deve estar entre ${TAXA_MINIMA} e ${TAXA_MAXIMA}% a.a.`;
  }
  return null;
}

export function validarDataAplicacaoRendaFixa(
  valor: string,
  hoje = hojeParaValidacao(),
): string | null {
  if (valor === "") {
    return "Informe a data de aplicação.";
  }
  if (!dataIsoValida(valor)) {
    return "Data de aplicação inválida.";
  }
  if (valor > hoje) {
    return "A data de aplicação não pode ser futura.";
  }
  return null;
}

export function validarVencimentoRendaFixa(
  valor: string,
  dataAplicacao: string,
): string | null {
  if (valor === "") {
    return null;
  }
  if (!dataIsoValida(valor)) {
    return "Data de vencimento inválida.";
  }
  if (dataIsoValida(dataAplicacao) && valor <= dataAplicacao) {
    return "O vencimento deve ser posterior à aplicação.";
  }
  return null;
}

export function validarValorAplicadoRendaFixa(valor: string): string | null {
  if (valor.trim() === "") {
    return "Informe o valor aplicado.";
  }
  const parsed = parseDecimalPtBr(valor, true);
  if (parsed === null) {
    return "Informe um valor válido (ex.: 1.234,56).";
  }
  if (!parsed.isPositive() || parsed.isZero()) {
    return "O valor aplicado deve ser maior que zero.";
  }
  return null;
}

export function validarSaldoRendaFixa(valor: string): string | null {
  if (valor.trim() === "") {
    return "Informe o saldo atual.";
  }
  const parsed = parseDecimalPtBr(valor, true);
  if (parsed === null) {
    return "Saldo atual inválido.";
  }
  if (parsed.isNegative()) {
    return "O saldo atual não pode ser negativo.";
  }
  return null;
}

export function validarCarenciaRendaFixa(valor: string, dataAplicacao: string): string | null {
  if (valor === "") {
    return null;
  }
  if (!dataIsoValida(valor)) {
    return "Data de carência inválida.";
  }
  if (dataIsoValida(dataAplicacao) && valor < dataAplicacao) {
    return "A carência não pode ser anterior à aplicação.";
  }
  return null;
}

export function validarObservacoesRendaFixa(valor: string): string | null {
  return valor.trim().length > OBSERVACOES_MAX
    ? `As observações devem ter no máximo ${OBSERVACOES_MAX} caracteres.`
    : null;
}

// ---------------------------------------------------------------------------
// Erros do envelope (details.errors[].field + códigos sem campo)
// ---------------------------------------------------------------------------

/**
 * Converte o envelope no mapa de erros por campo.
 *
 * Os códigos RF_* do catálogo não carregam `details.errors`; sem este
 * mapeamento o titular veria só um alerta genérico e não saberia qual campo
 * corrigir (UI_SPEC §16).
 */
export function mapaDeErrosRendaFixa(error: ApiError): Record<string, string> {
  switch (error.code) {
    case "RF_VENCIMENTO_INVALIDO":
      return { vencimento: error.message };
    case "RF_TAXA_INVALIDA":
      return { taxa: error.message };
    case "RF_SALDO_INVALIDO":
      return { saldoAtual: error.message };
    default:
      return errosPorCampo(error);
  }
}

export function lerTraceId(error: ApiError): string | null {
  const valor = error.details?.traceId;
  return typeof valor === "string" ? valor : null;
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

/** Alerta mais severo do grupo; `null` quando não há alerta. */
export function alertaMaisSevero(
  alertas: readonly AlertaRendaFixa[],
): AlertaRendaFixa | null {
  if (alertas.length === 0) {
    return null;
  }
  return [...alertas].sort(
    (a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade],
  )[0];
}

/** Agrupa os alertas por `tituloFixoId` para marcar a linha correspondente. */
export function agruparAlertasPorTitulo(
  alertas: readonly AlertaRendaFixa[],
): Map<string, readonly AlertaRendaFixa[]> {
  const mapa = new Map<string, AlertaRendaFixa[]>();
  for (const alerta of alertas) {
    const grupo = mapa.get(alerta.tituloFixoId);
    if (grupo === undefined) {
      mapa.set(alerta.tituloFixoId, [alerta]);
    } else {
      grupo.push(alerta);
    }
  }
  return mapa;
}

export interface ContagemAlertas {
  readonly INFO: number;
  readonly ATENCAO: number;
  readonly CRITICO: number;
}

export function contarAlertas(alertas: readonly AlertaRendaFixa[]): ContagemAlertas {
  const contagem = { INFO: 0, ATENCAO: 0, CRITICO: 0 };
  for (const alerta of alertas) {
    contagem[alerta.severidade] += 1;
  }
  return contagem;
}
