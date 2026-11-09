import { Decimal } from "../../lib/decimal";
import type { ItemDesvio } from "../alocacao/calcular-desvios";
import type { CarteiraConsolidada } from "../carteira/consolidar-carteira";
import type { IndicadoresDashboard, MetaIndicadorDashboard } from "./tipos";

/**
 * Indicadores do dashboard (RN-061).
 *
 * Função pura: recebe a carteira já consolidada (RN-020), os desvios já
 * calculados (RN-021-3) e o custo aplicado da renda fixa. A regra de
 * patrimônio/percentual NÃO é recalculada aqui — os campos são reaproveitados
 * do módulo de carteira.
 *
 * - `valorAtual` = patrimônio total (na Fase 1 os FIIs entram pelo custo, sem
 *   cotação — RN-091);
 * - `totalInvestido` = custo dos FIIs + `valorAplicado` da renda fixa;
 * - `resultadoAcumulado` = `(valorAtual − totalInvestido) + rendimentos totais`
 *   (todo o histórico, não apenas o ano corrente);
 * - `rendimentosAno` continua sendo o acumulado do ano exposto pela carteira.
 */

export interface EntradaIndicadoresDashboard {
  readonly carteira: CarteiraConsolidada;
  /** `null` quando o titular ainda não configurou metas. */
  readonly desvios: readonly ItemDesvio[] | null;
  /** Soma de `investimento_renda_fixa.valor_aplicado`, com 2 casas. */
  readonly valorAplicadoRendaFixa: string;
  /** Soma de todos os rendimentos do titular, com 2 casas. */
  readonly rendimentosTotais: string;
}

function montarMeta(
  desvios: readonly ItemDesvio[] | null,
): readonly MetaIndicadorDashboard[] {
  if (desvios === null) {
    return [];
  }

  return desvios
    .filter((desvio) => desvio.escopo === "CLASSE")
    .map((desvio) => ({
      codigo: desvio.codigo,
      atual: desvio.percentualAtual,
      meta: desvio.percentualMeta,
      desvio: desvio.desvioPontos,
      situacao: desvio.situacao,
    }));
}

export function montarIndicadores(
  entrada: EntradaIndicadoresDashboard,
): IndicadoresDashboard {
  const resumo = entrada.carteira.resumo;

  const valorAtual = Decimal.from(resumo.patrimonioTotal);
  const totalInvestido = Decimal.from(resumo.fiis).add(
    Decimal.from(entrada.valorAplicadoRendaFixa),
  );
  const rendimentosTotais = Decimal.from(entrada.rendimentosTotais);
  const resultadoAcumulado = valorAtual
    .sub(totalInvestido)
    .add(rendimentosTotais);

  return {
    vazio: valorAtual.isZero() && rendimentosTotais.isZero(),
    patrimonioTotal: resumo.patrimonioTotal,
    totalInvestido: totalInvestido.toFixed(2),
    valorAtual: resumo.patrimonioTotal,
    resultadoAcumulado: resultadoAcumulado.toFixed(2),
    rendaMensal: resumo.rendimentosMes,
    rendimentosAno: resumo.rendimentosAcumuladosAno,
    percentualRendaFixa: resumo.percentualRendaFixa,
    percentualFiis: resumo.percentualFiis,
    meta: montarMeta(entrada.desvios),
  };
}
