import type { Decimal } from "../../lib/decimal";

/**
 * Tipos do domínio de posição e preço médio (RN-014 a RN-019).
 *
 * Dinheiro e quantidade trafegam como `Decimal` (ADR-006); datas de negócio
 * como `YYYY-MM-DD` e o instante de criação como `Date`, usados apenas para a
 * ordenação determinística `(data, criado_em)` exigida pela reconstrução.
 */

export type TipoMovimentacao =
  | "COMPRA"
  | "VENDA"
  | "DIVIDENDO"
  | "JUROS"
  | "APLICACAO_RF"
  | "RESGATE_RF"
  | "TAXA";

export type TipoRendimento = "DIVIDENDO" | "JURO" | "AMORTIZACAO";

export type OrigemDado = "MANUAL" | "PROVEDOR" | "IMPORTACAO_CVM";

/** Movimentação como o cálculo de posição precisa vê-la (DATA_MODEL.md §4.5). */
export interface MovimentacaoParaPosicao {
  readonly id: string;
  readonly tipo: TipoMovimentacao;
  /** Data do fato, `YYYY-MM-DD`. */
  readonly data: string;
  /** Instante de criação, desempate dentro do mesmo dia. */
  readonly criadoEm: Date;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly canceladaEm: Date | null;
}

/** Posição corrente de um ativo; quantidade, custo e preço médio derivados. */
export interface Posicao {
  readonly quantidade: Decimal;
  readonly precoMedio: Decimal;
  readonly custoTotal: Decimal;
}

export type CodigoErroPosicao =
  | "MOV_POSICAO_NEGATIVA"
  | "MOV_VALOR_INCONSISTENTE"
  | "MOV_QTD_OBRIGATORIA";

/** Erro tipado do cálculo de posição, mapeável para o catálogo HTTP. */
export interface ErroPosicao {
  readonly codigo: CodigoErroPosicao;
  readonly mensagem: string;
  readonly detalhes: Readonly<Record<string, string>>;
}
