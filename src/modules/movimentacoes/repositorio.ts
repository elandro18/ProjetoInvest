/**
 * Port de persistência de movimentações (RN-014, RN-084; DATA_MODEL.md §4.5–§4.7).
 *
 * O domínio não conhece Prisma: estes tipos e o contrato são implementados em
 * `src/infra/db/movimentacao-repositorio.ts`. Toda operação recebe `usuarioId`
 * — isolamento por titular é regra de repositório, nunca do chamador.
 *
 * `posicao_ativo` é cache derivado: o repositório só grava a posição calculada
 * quando ela é não negativa. Quando o titular confirma uma exceção de posição
 * negativa (RN-018), a movimentação é a fonte da verdade e o cache é removido —
 * uma posição negativa nunca é persistida (DATA_MODEL.md §6.5).
 */

import type {
  MovimentacaoParaPosicao,
  OrigemDado,
  TipoMovimentacao,
  TipoRendimento,
} from "../posicao/tipos";

export const TIPOS_MOVIMENTACAO = [
  "COMPRA",
  "VENDA",
  "DIVIDENDO",
  "JUROS",
  "APLICACAO_RF",
  "RESGATE_RF",
  "TAXA",
] as const;

export const TIPOS_COM_QUANTIDADE: readonly TipoMovimentacao[] = ["COMPRA", "VENDA"];

/** Tipos de renda fixa ainda sem vínculo com `investimento_renda_fixa` (PEND-017). */
export const TIPOS_RENDA_FIXA: readonly TipoMovimentacao[] = [
  "APLICACAO_RF",
  "RESGATE_RF",
];

/** Código da classe de renda fixa em `classe_ativo` (DATA_MODEL.md §4.1). */
export const CLASSE_RENDA_FIXA = "RENDA_FIXA";

export const ORDENACOES_MOVIMENTACAO = ["data", "valorTotal", "criadoEm"] as const;

export type OrdenacaoMovimentacao = (typeof ORDENACOES_MOVIMENTACAO)[number];

export const DIRECOES_ORDEM = ["asc", "desc"] as const;

export type DirecaoOrdem = (typeof DIRECOES_ORDEM)[number];

export const PAGE_SIZE_PADRAO = 20;
export const PAGE_SIZE_MAXIMO = 100;

export type StatusAtivoMovimentacao = "ATIVO" | "INATIVO" | "EM_ANALISE";

/** Ativo como a criação de movimentação precisa vê-lo (RN-013, RN-014). */
export interface AtivoMovimentacaoRef {
  readonly id: string;
  readonly ticker: string;
  readonly status: StatusAtivoMovimentacao;
  readonly classeCodigo: string;
}

export interface PosicaoPersistida {
  /** `numeric(18,8)`. */
  readonly quantidade: string;
  /** `numeric(18,6)`. */
  readonly precoMedio: string;
  /** `numeric(18,2)`. */
  readonly custoTotal: string;
}

export interface MovimentacaoRegistro {
  readonly id: string;
  readonly ativo: { readonly id: string; readonly ticker: string };
  readonly tipo: TipoMovimentacao;
  /** Data do fato, `YYYY-MM-DD`. */
  readonly data: string;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly observacoes: string | null;
  readonly canceladaEm: Date | null;
  readonly cancelamentoMotivo: string | null;
  readonly idempotencyKey: string | null;
  readonly criadoEm: Date;
}

export interface NovaMovimentacao {
  readonly usuarioId: string;
  readonly ativoId: string;
  readonly tipo: TipoMovimentacao;
  readonly data: string;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly observacoes: string | null;
  readonly idempotencyKey: string | null;
  readonly criadoEm: Date;
}

/** Provento gerado por `DIVIDENDO`/`JUROS` (RN-017). */
export interface NovoRendimento {
  readonly tipo: TipoRendimento;
  readonly dataPagamento: string;
  /** `YYYY-MM`. */
  readonly competencia: string;
  readonly valor: string;
  readonly origem: OrigemDado;
}

export interface DadosCriacaoMovimentacao {
  readonly nova: NovaMovimentacao;
  readonly rendimento: NovoRendimento | null;
  /** `null` quando a posição resultante é negativa: o cache não é gravado. */
  readonly posicao: PosicaoPersistida | null;
}

export interface FiltroMovimentacoes {
  readonly usuarioId: string;
  readonly ativoId?: string;
  readonly tipo?: TipoMovimentacao;
  readonly de?: string;
  readonly ate?: string;
  readonly incluirCanceladas: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: OrdenacaoMovimentacao;
  readonly order: DirecaoOrdem;
}

export interface PaginaMovimentacoes {
  readonly itens: readonly MovimentacaoRegistro[];
  readonly total: number;
}

/** Corrida de idempotência: outra requisição gravou a mesma chave antes. */
export class MovimentacaoIdempotenteError extends Error {
  constructor() {
    super("Movimentação já gravada com esta chave de idempotência.");
    this.name = "MovimentacaoIdempotenteError";
  }
}

export interface MovimentacaoRepositorio {
  /** Ativo do titular; `null` quando não existe ou pertence a outro usuário. */
  buscarAtivo(usuarioId: string, ativoId: string): Promise<AtivoMovimentacaoRef | null>;

  buscarPorIdempotencia(
    usuarioId: string,
    idempotencyKey: string,
  ): Promise<MovimentacaoRegistro | null>;

  /** Movimentações não canceladas do ativo, insumo da reconstrução de posição. */
  listarParaPosicao(
    usuarioId: string,
    ativoId: string,
  ): Promise<readonly MovimentacaoParaPosicao[]>;

  /** Cria movimentação + rendimento + posição numa única transação. */
  criar(dados: DadosCriacaoMovimentacao): Promise<MovimentacaoRegistro>;

  listar(filtro: FiltroMovimentacoes): Promise<PaginaMovimentacoes>;

  /** Busca sempre escopada ao titular; `null` quando é de outro usuário. */
  buscarPorId(usuarioId: string, movimentacaoId: string): Promise<MovimentacaoRegistro | null>;

  /**
   * Cancela logicamente (nunca delete físico) e regrava a posição na mesma
   * transação. `null` quando a movimentação já foi cancelada por outra corrida.
   */
  cancelar(
    usuarioId: string,
    movimentacaoId: string,
    motivo: string,
    posicao: PosicaoPersistida | null,
    canceladaEm: Date,
  ): Promise<MovimentacaoRegistro | null>;
}
