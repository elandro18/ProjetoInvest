/**
 * Port de agregação do valor da carteira (RN-020, RN-021, RN-089, RN-091).
 *
 * O domínio não conhece Prisma: o adaptador vive em
 * `src/infra/db/valor-carteira-prisma.ts`. O port é deliberadamente pequeno e
 * reutilizável: a RN-020 (carteira consolidada) e a RN-021 (metas/desvios)
 * precisam da mesma base — patrimônio total e valor por classe/segmento.
 *
 * Regras de avaliação desta primeira fase:
 * - posições de FII entram pelo custo (`posicao_ativo.custo_total`), marcadas
 *   como `valorIndisponivel` porque não há cotação de mercado (RN-091);
 * - renda fixa entra pelo `saldo_atual`;
 * - o patrimônio total é a soma das duas fontes (RN-089).
 */

export const BASE_CALCULO_PATRIMONIO_TOTAL = "PATRIMONIO_TOTAL" as const;

export type BaseCalculo = typeof BASE_CALCULO_PATRIMONIO_TOTAL;

export interface ValorReferenciaCarteira {
  readonly id: string;
  /** Valor com 2 casas (`"15170.00"`). */
  readonly valor: string;
  /** `true` quando o valor é custo/saldo, sem cotação de mercado (RN-091). */
  readonly valorIndisponivel: boolean;
}

export interface ValoresCarteira {
  /** Patrimônio total com 2 casas (`"40000.00"`). */
  readonly total: string;
  readonly classes: readonly ValorReferenciaCarteira[];
  readonly segmentos: readonly ValorReferenciaCarteira[];
}

export interface ValorCarteira {
  agregar(usuarioId: string): Promise<ValoresCarteira>;
}
