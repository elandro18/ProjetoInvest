import { Decimal } from "@/src/lib/decimal";
import type {
  ComparativoSimulacaoApi,
  LinhaDeltaApi,
  LinhaSimulacaoApi,
  SimulacaoAporteApi,
} from "@/src/modules/aportes/apresentacao";
import {
  ATALHOS_VALOR,
  formatarMoeda,
  lerValorDisponivel,
  rotuloReferencia,
} from "./aportes-ui";

/**
 * Regras de forma do simulador de aporte (RN-028; UI_SPEC §10, §15–§19).
 *
 * O cálculo do antes/depois é exclusivamente do servidor (`POST
 * /api/aportes/simulacao`). Aqui só vivem máscara, sinal, largura de barra e
 * a explicação em texto da variação — a tela nunca recalcula percentual.
 *
 * O delta chega com 6 casas e a leitura útil é de 1 casa: o arredondamento é
 * feito uma única vez, aqui, para que o sinal, o texto e a barra mostrem
 * exatamente o mesmo número.
 */

/** Os mesmos atalhos da sugestão (RN-028): 500 / 1.000 / 1.500 / 2.000. */
export const ATALHOS_SIMULACAO = ATALHOS_VALOR;

const CASAS_PERCENTUAL = 1;
const CASAS_BARRA = 2;

// ---------------------------------------------------------------------------
// Valor a simular
// ---------------------------------------------------------------------------

/** `null` quando o valor é aceitável; texto de erro caso contrário. */
export function validarValorSimulacao(texto: string): string | null {
  if (texto.trim() === "") {
    return "Informe o valor a simular (ex.: 1.000,00).";
  }

  const valor = lerValorDisponivel(texto);
  if (valor === null) {
    return "Informe um valor válido (ex.: 1.234,56).";
  }

  if (!valor.gt("0")) {
    return "O valor a simular deve ser maior que zero.";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Percentual, delta e patrimônio
// ---------------------------------------------------------------------------

/** Percentual do comparativo com 1 casa (`"40.909091"` → `"40,9%"`). */
export function formatarPercentualSimulacao(percentual: string, casas = CASAS_PERCENTUAL): string {
  const parsed = Decimal.parse(percentual);
  if (!parsed.ok) {
    return "Indisponível";
  }

  return `${parsed.value.toFixed(casas).replace(".", ",")}%`;
}

export type Variacao = "aumento" | "reducao" | "sem-alteracao" | "indisponivel";

export interface DescricaoDelta {
  /** Sinal explícito e unidade (`"+5,9 p.p."`, `"−5,9 p.p."`, `"sem alteração"`). */
  readonly texto: string;
  /** Leitura em palavras — a cor nunca é o único portador (UI_SPEC §18). */
  readonly explicacao: string;
  readonly variacao: Variacao;
}

/** Traduz `depois − antes` (p.p.) em sinal + texto, arredondando 1 casa uma única vez. */
export function descreverDelta(pontosPercentuais: string): DescricaoDelta {
  const parsed = Decimal.parse(pontosPercentuais);
  if (!parsed.ok) {
    return {
      texto: "Indisponível",
      explicacao: "Variação indisponível.",
      variacao: "indisponivel",
    };
  }

  const arredondado = parsed.value.round(CASAS_PERCENTUAL);
  if (arredondado.isZero()) {
    return {
      texto: "sem alteração",
      explicacao: "sem alteração na participação",
      variacao: "sem-alteracao",
    };
  }

  const magnitude = arredondado.abs().toFixed(CASAS_PERCENTUAL).replace(".", ",");

  if (arredondado.isNegative()) {
    return {
      texto: `−${magnitude} p.p.`,
      explicacao: `redução de ${magnitude} p.p.`,
      variacao: "reducao",
    };
  }

  return {
    texto: `+${magnitude} p.p.`,
    explicacao: `aumento de ${magnitude} p.p.`,
    variacao: "aumento",
  };
}

/**
 * Diferença entre o patrimônio de depois e o de antes (`"+R$ 1.000,00"`).
 *
 * É a única conta da tela — soma de dois valores já devolvidos pelo contrato,
 * para resumir o efeito do aporte hipotético.
 */
export function diferencaPatrimonio(antes: string, depois: string): string {
  const inicio = Decimal.parse(antes);
  const fim = Decimal.parse(depois);
  if (!inicio.ok || !fim.ok) {
    return "Indisponível";
  }

  const diferenca = fim.value.sub(inicio.value);
  if (diferenca.isZero()) {
    return "sem alteração";
  }

  const sinal = diferenca.isNegative() ? "−" : "+";
  return `${sinal}${formatarMoeda(diferenca.abs().toFixed(2))}`;
}

/** Carteira sem patrimônio: a simulação vale, mas parte apenas das metas (RN-028). */
export function carteiraVazia(simulacao: SimulacaoAporteApi): boolean {
  const total = Decimal.parse(simulacao.antes.patrimonioTotal);
  return total.ok && total.value.isZero();
}

/** Largura da barra (0–100), a partir do percentual do contrato. */
export function larguraBarra(percentual: string): number {
  const parsed = Decimal.parse(percentual);
  if (!parsed.ok || parsed.value.isNegative()) {
    return 0;
  }

  if (parsed.value.gt("100")) {
    return 100;
  }

  // Conversão explícita só na borda de apresentação (ADR-006): a barra é CSS.
  return parsed.value.round(CASAS_BARRA).toNumber();
}

// ---------------------------------------------------------------------------
// Antes × depois
// ---------------------------------------------------------------------------

export interface LinhaComparacao {
  readonly codigo: string;
  readonly rotulo: string;
  readonly antes: LinhaSimulacaoApi;
  readonly depois: LinhaSimulacaoApi;
  readonly deltaTexto: string;
  readonly deltaExplicacao: string;
  readonly variacao: Variacao;
}

function linhaZerada(codigo: string): LinhaSimulacaoApi {
  return { codigo, valor: "0.00", percentual: "0.000000" };
}

function unirCodigos(
  escopos: readonly (readonly { readonly codigo: string }[])[],
): readonly string[] {
  return [...new Set(escopos.flatMap((linhas) => linhas.map((linha) => linha.codigo)))];
}

/**
 * Comparativo linha a linha de um escopo (classe ou segmento).
 *
 * A API devolve todas as linhas, inclusive as que não recebem aporte
 * (RN-028-1). Todas são exibidas: a que não muda aparece como "sem alteração"
 * — omitir daria a impressão de que a classe deixou de existir na carteira.
 * A ordem de leitura é a das metas (`antes`), preservada pelo servidor.
 */
export function compararLinhas(
  antes: readonly LinhaSimulacaoApi[],
  depois: readonly LinhaSimulacaoApi[],
  delta: readonly LinhaDeltaApi[],
): readonly LinhaComparacao[] {
  const mapaAntes = new Map(antes.map((linha) => [linha.codigo, linha]));
  const mapaDepois = new Map(depois.map((linha) => [linha.codigo, linha]));
  const mapaDelta = new Map(delta.map((linha) => [linha.codigo, linha]));

  return unirCodigos([antes, depois, delta]).map((codigo) => {
    const descricao = descreverDelta(mapaDelta.get(codigo)?.pontosPercentuais ?? "0");

    return {
      codigo,
      rotulo: rotuloReferencia(codigo),
      antes: mapaAntes.get(codigo) ?? linhaZerada(codigo),
      depois: mapaDepois.get(codigo) ?? linhaZerada(codigo),
      deltaTexto: descricao.texto,
      deltaExplicacao: descricao.explicacao,
      variacao: descricao.variacao,
    };
  });
}

/** Atalho para o comparativo de um `ComparativoSimulacaoApi` completo. */
export function compararEscopo(
  antes: ComparativoSimulacaoApi,
  depois: ComparativoSimulacaoApi,
  delta: { readonly classe: readonly LinhaDeltaApi[]; readonly segmento: readonly LinhaDeltaApi[] },
  escopo: "classe" | "segmento",
): readonly LinhaComparacao[] {
  return compararLinhas(antes[escopo], depois[escopo], delta[escopo]);
}
