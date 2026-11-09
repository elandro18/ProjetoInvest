import { Decimal } from "../../lib/decimal";
import type { ItemDesvio } from "../alocacao/calcular-desvios";
import type { CarteiraConsolidada } from "../carteira/consolidar-carteira";
import type { EvolucaoCarteira } from "../carteira/evolucao-carteira";
import type {
  DividendoBrutoDashboard,
  RendimentoPeriodoDashboard,
} from "./repositorio";
import type {
  DividendoDashboard,
  GraficosDashboard,
  ItemOportunidadeDashboard,
  OportunidadesDashboard,
  PontoEvolucaoRendimentosDashboard,
} from "./tipos";

/**
 * Séries e oportunidades do dashboard (RN-062, RN-063).
 *
 * Funções puras: recebem os proventos já lidos e os desvios já calculados.
 * Nenhuma regra de patrimônio/percentual é recalculada — distribuição e
 * evolução vêm da carteira (RN-020/RN-062).
 */

export const LIMITE_DIVIDENDOS_DASHBOARD = 12;

/**
 * Soma os rendimentos por mês dentro da janela. Meses sem provento entram como
 * `"0.00"` para a série ter exatamente `meses.length` pontos (RN-062); um
 * provento fora da janela é ignorado.
 */
export function montarEvolucaoRendimentos(
  rendimentos: readonly RendimentoPeriodoDashboard[],
  meses: readonly string[],
): readonly PontoEvolucaoRendimentosDashboard[] {
  const totais = new Map<string, Decimal>(
    meses.map((mes) => [mes, Decimal.zero(2)]),
  );

  for (const rendimento of rendimentos) {
    const mes = rendimento.dataPagamento.slice(0, 7);
    const atual = totais.get(mes);

    if (atual !== undefined) {
      totais.set(mes, atual.add(Decimal.from(rendimento.valor)));
    }
  }

  return meses.map((mes) => ({
    mes,
    valor: (totais.get(mes) ?? Decimal.zero(2)).toFixed(2),
  }));
}

/**
 * Últimos proventos por data decrescente (desempate por ticker para a resposta
 * ser determinística). A leitura já limita no banco; o domínio reaplica o
 * limite para não depender do adaptador.
 */
export function selecionarDividendos(
  dividendos: readonly DividendoBrutoDashboard[],
  limite = LIMITE_DIVIDENDOS_DASHBOARD,
): readonly DividendoDashboard[] {
  return [...dividendos]
    .sort(
      (a, b) =>
        b.dataPagamento.localeCompare(a.dataPagamento) ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, Math.max(0, limite))
    .map((dividendo) => ({
      data: dividendo.dataPagamento,
      ativo: dividendo.ticker,
      valor: dividendo.valor,
    }));
}

function itemOportunidade(desvio: ItemDesvio): ItemOportunidadeDashboard {
  return {
    escopo: desvio.escopo,
    codigo: desvio.codigo,
    percentualAtual: desvio.percentualAtual,
    percentualMeta: desvio.percentualMeta,
    desvioPontos: desvio.desvioPontos,
    valorParaMeta: desvio.valorParaMeta,
  };
}

/**
 * Classes e segmentos abaixo da meta. Watchlist, alertas e sugestão de aporte
 * são Fases 2/4 — o bloco existe vazio para a UI exibir "disponível em breve".
 */
export function montarOportunidades(
  desvios: readonly ItemDesvio[],
): OportunidadesDashboard {
  const abaixo = desvios
    .filter((desvio) => desvio.situacao === "ABAIXO")
    .map(itemOportunidade);

  return {
    classesAbaixo: abaixo.filter((item) => item.escopo === "CLASSE"),
    segmentosAbaixo: abaixo.filter((item) => item.escopo === "SEGMENTO"),
    watchlist: [],
    comAlerta: [],
    sugestaoAporte: null,
  };
}

export interface EntradaGraficosDashboard {
  readonly carteira: CarteiraConsolidada;
  readonly evolucao: EvolucaoCarteira;
  readonly rendimentos: readonly RendimentoPeriodoDashboard[];
  readonly dividendos: readonly DividendoBrutoDashboard[];
  readonly meses: readonly string[];
}

/** Monta o bloco de gráficos reaproveitando o que a carteira já consolidou. */
export function montarGraficos(
  entrada: EntradaGraficosDashboard,
): GraficosDashboard {
  return {
    porClasse: entrada.carteira.porClasse,
    porSegmento: entrada.carteira.porSegmento,
    evolucaoPatrimonial: entrada.evolucao.pontos,
    evolucaoRendimentos: montarEvolucaoRendimentos(entrada.rendimentos, entrada.meses),
    aportes: [],
    dividendos: selecionarDividendos(entrada.dividendos),
  };
}
