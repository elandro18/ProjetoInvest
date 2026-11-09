/**
 * Port de persistência de renda fixa (RN-057, RN-059; DATA_MODEL.md §4.8).
 *
 * O domínio não conhece Prisma: estes tipos e o contrato são implementados em
 * `src/infra/db/renda-fixa-repositorio.ts`. Toda operação recebe `usuarioId` —
 * isolamento por titular é regra de repositório, nunca do chamador.
 *
 * Datas de negócio trafegam como `YYYY-MM-DD` (API_CONTRACTS.md §1); valores
 * monetários e a taxa como string decimal, sempre com a escala do contrato.
 */

export const PRODUTOS_RENDA_FIXA = [
  "TESOURO_SELIC",
  "TESOURO_IPCA",
  "TESOURO_PREFIXADO",
  "CDB",
  "LCI",
  "LCA",
  "DEBENTURE",
  "OUTRO",
] as const;

export type ProdutoRendaFixa = (typeof PRODUTOS_RENDA_FIXA)[number];

export const INDEXADORES_RENDA_FIXA = ["PRE", "POS_CDI", "IPCA", "SELIC", "OUTRO"] as const;

export type IndexadorRendaFixa = (typeof INDEXADORES_RENDA_FIXA)[number];

export const LIQUIDEZ_RENDA_FIXA = ["DIARIA", "NO_VENCIMENTO", "PRAZO"] as const;

export type LiquidezRendaFixa = (typeof LIQUIDEZ_RENDA_FIXA)[number];

export const STATUS_SALDO = ["INFORMADO", "ESTIMADO", "CONFIRMADO"] as const;

export type StatusSaldo = (typeof STATUS_SALDO)[number];

export const ORDENACOES_RENDA_FIXA = [
  "criadoEm",
  "instituicao",
  "produto",
  "vencimento",
  "dataAplicacao",
  "saldoAtual",
] as const;

export type OrdenacaoRendaFixa = (typeof ORDENACOES_RENDA_FIXA)[number];

export const DIRECOES_ORDEM = ["asc", "desc"] as const;

export type DirecaoOrdem = (typeof DIRECOES_ORDEM)[number];

/** Produtos cobertos pelo FGC (RN-057; API_CONTRACTS.md §6.2). */
export const PRODUTOS_COM_FGC: readonly ProdutoRendaFixa[] = ["CDB", "LCI", "LCA"];

/** Título persistido, já normalizado para a borda. */
export interface InvestimentoRendaFixaRegistro {
  readonly id: string;
  readonly instituicao: string;
  readonly produto: ProdutoRendaFixa;
  readonly indexador: IndexadorRendaFixa;
  /** Percentual ao ano com 6 casas (`"12.500000"`). */
  readonly taxa: string;
  readonly dataAplicacao: string;
  readonly vencimento: string | null;
  /** Valor aplicado com 2 casas (`"10000.00"`). */
  readonly valorAplicado: string;
  /** Saldo atual com 2 casas (`"10450.00"`). */
  readonly saldoAtual: string;
  readonly statusSaldo: StatusSaldo;
  readonly liquidez: LiquidezRendaFixa;
  readonly carenciaAte: string | null;
  readonly coberturaFgc: boolean;
  readonly observacoes: string | null;
  readonly criadoEm: Date;
  readonly atualizadoEm: Date;
}

export interface NovoInvestimentoRendaFixa {
  readonly usuarioId: string;
  readonly instituicao: string;
  readonly produto: ProdutoRendaFixa;
  readonly indexador: IndexadorRendaFixa;
  readonly taxa: string;
  readonly dataAplicacao: string;
  readonly vencimento: string | null;
  readonly valorAplicado: string;
  readonly saldoAtual: string;
  readonly statusSaldo: StatusSaldo;
  readonly liquidez: LiquidezRendaFixa;
  readonly carenciaAte: string | null;
  readonly coberturaFgc: boolean;
  readonly observacoes: string | null;
}

/**
 * Campos editáveis via `PATCH /api/renda-fixa/{id}` (RN-057-2, RN-059).
 *
 * `undefined` = não alterar; `null` = limpar o campo.
 */
export interface CamposAtualizacaoRendaFixa {
  readonly saldoAtual?: string;
  readonly statusSaldo?: StatusSaldo;
  readonly liquidez?: LiquidezRendaFixa;
  readonly carenciaAte?: string | null;
  readonly coberturaFgc?: boolean;
  readonly observacoes?: string | null;
}

export interface FiltroRendaFixa {
  readonly usuarioId: string;
  readonly instituicao?: string;
  readonly produto?: ProdutoRendaFixa;
  readonly vencimentoAte?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: OrdenacaoRendaFixa;
  readonly order: DirecaoOrdem;
}

export interface PaginaRendaFixa {
  readonly itens: readonly InvestimentoRendaFixaRegistro[];
  readonly total: number;
}

export interface RendaFixaRepositorio {
  criar(novo: NovoInvestimentoRendaFixa): Promise<InvestimentoRendaFixaRegistro>;

  listar(filtro: FiltroRendaFixa): Promise<PaginaRendaFixa>;

  /** Busca sempre escopada ao titular; `null` quando é de outro usuário. */
  buscarPorId(usuarioId: string, id: string): Promise<InvestimentoRendaFixaRegistro | null>;

  /** `null` quando o título não pertence ao titular. */
  atualizar(
    usuarioId: string,
    id: string,
    campos: CamposAtualizacaoRendaFixa,
  ): Promise<InvestimentoRendaFixaRegistro | null>;

  /** Todos os títulos do titular, sem paginação — insumo dos alertas (RN-058). */
  listarPorUsuario(usuarioId: string): Promise<readonly InvestimentoRendaFixaRegistro[]>;
}
