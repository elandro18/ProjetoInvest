import type { AppErrorCode } from "../../lib/errors";
import type { EscopoMeta } from "../alocacao/repositorio";
import type { SituacaoDesvio } from "../alocacao/metas";
import type { ItemDistribuicaoCarteira } from "../carteira/consolidar-carteira";
import type { PontoEvolucaoCarteira } from "../carteira/evolucao-carteira";

/**
 * Contrato do agregado do dashboard (RN-061, RN-062, RN-063, RN-073;
 * API_CONTRACTS.md §5.3).
 *
 * Os nove indicadores reutilizam a carteira consolidada (RN-020) e os desvios
 * da alocação (RN-021): o dashboard não recalcula patrimônio nem percentual.
 * Todos os valores monetários e percentuais saem como string decimal — a borda
 * só serializa, nunca converte para `number`.
 */

/** Comparação de uma classe com a meta vigente (RN-061, RN-021-3). */
export interface MetaIndicadorDashboard {
  /** `classe_ativo.codigo` (`RENDA_FIXA`, `FII`). */
  readonly codigo: string;
  /** Percentual atual com 6 casas. */
  readonly atual: string;
  /** Percentual da meta com 6 casas. */
  readonly meta: string;
  /** Atual − meta, em pontos percentuais, com 6 casas. */
  readonly desvio: string;
  readonly situacao: SituacaoDesvio;
}

/** Os nove indicadores do painel (RN-061). */
export interface IndicadoresDashboard {
  /** `true` quando o titular não tem patrimônio nem proventos (primeiro acesso). */
  readonly vazio: boolean;
  /** Patrimônio total com 2 casas (RN-020, RN-089). */
  readonly patrimonioTotal: string;
  /** Custo dos FIIs + `valorAplicado` da renda fixa, com 2 casas. */
  readonly totalInvestido: string;
  /** Valor atual das posições + saldo da renda fixa, com 2 casas. */
  readonly valorAtual: string;
  /** `(valorAtual − totalInvestido) + rendimentosAcumulados`, com 2 casas. */
  readonly resultadoAcumulado: string;
  /** Rendimentos recebidos no mês corrente (São Paulo), com 2 casas. */
  readonly rendaMensal: string;
  /** Rendimentos acumulados no ano corrente, com 2 casas. */
  readonly rendimentosAno: string;
  readonly percentualRendaFixa: string;
  readonly percentualFiis: string;
  /** Comparação por classe; vazio quando o titular ainda não tem metas. */
  readonly meta: readonly MetaIndicadorDashboard[];
}

/** Ponto da série mensal de rendimentos (RN-062). */
export interface PontoEvolucaoRendimentosDashboard {
  /** `YYYY-MM`. */
  readonly mes: string;
  /** Soma dos rendimentos do mês com 2 casas. */
  readonly valor: string;
}

/** Provento do histórico de dividendos (RN-062). */
export interface DividendoDashboard {
  /** `data_pagamento`, `YYYY-MM-DD`. */
  readonly data: string;
  /** `ativo.ticker`. */
  readonly ativo: string;
  /** Valor do provento com 2 casas. */
  readonly valor: string;
}

/** Séries do bloco de gráficos (RN-062; API_CONTRACTS.md §5.3). */
export interface GraficosDashboard {
  /** Reaproveita a distribuição já consolidada pela carteira (RN-020). */
  readonly porClasse: readonly ItemDistribuicaoCarteira[];
  readonly porSegmento: readonly ItemDistribuicaoCarteira[];
  /** Reaproveita a evolução patrimonial já calculada (RN-062, §5.2). */
  readonly evolucaoPatrimonial: readonly PontoEvolucaoCarteira[];
  /** Soma mensal de `rendimento` nos últimos 12 meses. */
  readonly evolucaoRendimentos: readonly PontoEvolucaoRendimentosDashboard[];
  /** Reservado para a Fase 2 (sugestão/histórico de aportes). */
  readonly aportes: readonly never[];
  /** Últimos 12 proventos, ordenados por data decrescente. */
  readonly dividendos: readonly DividendoDashboard[];
}

/** Classe ou segmento abaixo da meta (RN-063, Fase 1: classes e segmentos). */
export interface ItemOportunidadeDashboard {
  readonly escopo: EscopoMeta;
  readonly codigo: string;
  readonly percentualAtual: string;
  readonly percentualMeta: string;
  readonly desvioPontos: string;
  /** Valor necessário para atingir a meta, com 2 casas. */
  readonly valorParaMeta: string;
}

/**
 * Painel de oportunidades (RN-063). `watchlist`, `comAlerta` e
 * `sugestaoAporte` dependem das Fases 2/4 — ficam vazios/`null` e a UI exibe
 * o estado "disponível em breve" (decisão 5 da análise técnica).
 */
export interface OportunidadesDashboard {
  readonly classesAbaixo: readonly ItemOportunidadeDashboard[];
  readonly segmentosAbaixo: readonly ItemOportunidadeDashboard[];
  readonly watchlist: readonly never[];
  readonly comAlerta: readonly never[];
  readonly sugestaoAporte: null;
}

export type NomeBlocoDashboard = "indicadores" | "graficos" | "oportunidades";

/** Falha de um bloco, sem derrubar os demais (RN-073). */
export interface ErroBlocoDashboard {
  readonly bloco: NomeBlocoDashboard;
  readonly code: AppErrorCode;
  readonly message: string;
}

/**
 * Resposta de `GET /api/dashboard`. Blocos que falharam ficam ausentes e são
 * listados em `erros`; a borda devolve 503 apenas quando nenhum bloco pôde ser
 * produzido.
 */
export interface DashboardResultado {
  readonly indicadores?: IndicadoresDashboard;
  readonly graficos?: GraficosDashboard;
  readonly oportunidades?: OportunidadesDashboard;
  readonly erros: readonly ErroBlocoDashboard[];
}
