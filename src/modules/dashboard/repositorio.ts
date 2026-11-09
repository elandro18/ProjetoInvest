/**
 * Port de leitura do dashboard (RN-061, RN-062; API_CONTRACTS.md §5.3).
 *
 * O domínio não conhece Prisma: o adaptador vive em
 * `src/infra/db/dashboard-repositorio.ts`. Toda operação recebe `usuarioId` —
 * o isolamento por titular é regra de repositório, nunca do chamador.
 *
 * A carteira e os desvios vêm dos ports já existentes (RN-020/RN-021). Este
 * port cobre apenas o que o dashboard precisa e eles não expõem: o custo
 * aplicado da renda fixa e as séries de proventos.
 */

/** Provento no formato bruto de leitura (`data_pagamento` + valor). */
export interface RendimentoPeriodoDashboard {
  /** `data_pagamento`, `YYYY-MM-DD`. */
  readonly dataPagamento: string;
  /** Valor com 2 casas. */
  readonly valor: string;
}

/** Provento com o ticker do ativo, insumo do histórico de dividendos. */
export interface DividendoBrutoDashboard {
  /** `data_pagamento`, `YYYY-MM-DD`. */
  readonly dataPagamento: string;
  /** `ativo.ticker`. */
  readonly ticker: string;
  /** Valor com 2 casas. */
  readonly valor: string;
}

export interface DashboardRepositorio {
  /** Soma de `investimento_renda_fixa.valor_aplicado` (`"0.00"` sem títulos). */
  somarValorAplicadoRendaFixa(usuarioId: string): Promise<string>;

  /**
   * Soma de todos os rendimentos do titular, sem recorte de período
   * (`"0.00"` sem proventos). Alimenta o `resultadoAcumulado` da RN-061.
   */
  somarRendimentosTotais(usuarioId: string): Promise<string>;

  /**
   * Rendimentos pagos em `[de, ate]` (`YYYY-MM-DD`), sem recorte mensal — a
   * agregação por mês é feita no domínio.
   */
  listarRendimentos(
    usuarioId: string,
    de: string,
    ate: string,
  ): Promise<readonly RendimentoPeriodoDashboard[]>;

  /** Até `limite` proventos mais recentes, ordenados por data decrescente. */
  listarDividendos(
    usuarioId: string,
    limite: number,
  ): Promise<readonly DividendoBrutoDashboard[]>;
}
