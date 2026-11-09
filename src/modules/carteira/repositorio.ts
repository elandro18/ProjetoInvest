/**
 * Port de leitura da carteira consolidada (RN-020, RN-023, RN-062, RN-089,
 * RN-091; DATA_MODEL.md §4.6–§4.8).
 *
 * O domínio não conhece Prisma: o contrato é implementado em
 * `src/infra/db/carteira-repositorio.ts`. Toda operação recebe `usuarioId` —
 * o isolamento por titular é regra de repositório, nunca do chamador.
 *
 * A leitura do resumo e a da evolução são separadas de propósito: a evolução
 * só precisa do saldo de renda fixa atual e do razão de movimentações, não dos
 * rendimentos nem do catálogo de classes.
 */

import type { MovimentacaoParaPosicao } from "../posicao/tipos";

/** Classe ou segmento do catálogo de referência, já ordenado para a borda. */
export interface ReferenciaCarteira {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ordem: number;
}

/** Posição com quantidade > 0, já com a referência da classe/segmento do ativo. */
export interface PosicaoCarteira {
  readonly ativoId: string;
  /** `ativo.ticker`. */
  readonly ticker: string;
  /** `ativo.nome`. */
  readonly nome: string;
  /** `posicao_ativo.quantidade` com 8 casas. */
  readonly quantidade: string;
  /** `posicao_ativo.preco_medio` com 6 casas. */
  readonly precoMedio: string;
  /** `posicao_ativo.custo_total` com 2 casas. */
  readonly custoTotal: string;
  readonly classeId: string;
  readonly segmentoId: string | null;
}

/** Provento recebido, insumo do recorte mensal/anual (RN-020). */
export interface RendimentoCarteira {
  /** `data_pagamento`, `YYYY-MM-DD`. */
  readonly dataPagamento: string;
  /** Valor com 2 casas. */
  readonly valor: string;
}

export interface RendaFixaCarteira {
  /** Soma de `saldo_atual` com 2 casas; `"0.00"` sem títulos. */
  readonly saldoTotal: string;
  /** Quantidade de títulos cadastrados, independentemente do saldo. */
  readonly quantidadeTitulos: number;
}

export interface DadosCarteira {
  readonly posicoes: readonly PosicaoCarteira[];
  readonly rendaFixa: RendaFixaCarteira;
  readonly rendimentos: readonly RendimentoCarteira[];
  readonly classes: readonly ReferenciaCarteira[];
  readonly segmentos: readonly ReferenciaCarteira[];
}

/** Movimentação não cancelada, com o ativo para a reconstrução por ativo. */
export interface MovimentacaoCarteira extends MovimentacaoParaPosicao {
  readonly ativoId: string;
}

export interface CarteiraRepositorio {
  /**
   * Dados do resumo do titular. `hoje` (`YYYY-MM-DD`) delimita o ano corrente
   * usado na consulta de rendimentos; o recorte mensal/anual efetivo é feito
   * no domínio sobre a mesma lista.
   */
  carregarDados(usuarioId: string, hoje: string): Promise<DadosCarteira>;

  /** Soma dos saldos atuais de renda fixa, com 2 casas (`"0.00"` sem títulos). */
  carregarSaldoRendaFixa(usuarioId: string): Promise<string>;

  /**
   * Movimentações não canceladas até `ate` (`YYYY-MM-DD`), em ordem
   * `(data, criado_em)` — a mesma da reconstrução de posição (RN-015).
   */
  listarMovimentacoes(
    usuarioId: string,
    ate: string,
  ): Promise<readonly MovimentacaoCarteira[]>;
}
