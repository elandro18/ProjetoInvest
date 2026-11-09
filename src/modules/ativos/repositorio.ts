/**
 * Port de persistência de ativos (ADR-004, RN-010).
 *
 * O domínio não conhece Prisma: estes tipos e o contrato são implementados em
 * `src/infra/db/ativo-repositorio.ts`. Toda operação recebe `usuarioId` —
 * isolamento por titular é regra de repositório, nunca do chamador.
 */

export const STATUS_ATIVO = ["ATIVO", "INATIVO", "EM_ANALISE"] as const;

export type StatusAtivo = (typeof STATUS_ATIVO)[number];

/** Classe cujo segmento é obrigatório (RN-010; DATA_MODEL.md §4.4). */
export const CODIGO_CLASSE_FII = "FII";

export const ORDENACOES_ATIVO = ["ticker", "nome", "status", "criadoEm"] as const;

export type OrdenacaoAtivo = (typeof ORDENACOES_ATIVO)[number];

export const DIRECOES_ORDEM = ["asc", "desc"] as const;

export type DirecaoOrdem = (typeof DIRECOES_ORDEM)[number];

/** Classe como o domínio precisa vê-la para validar o cadastro. */
export interface ClasseAtivoRef {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ativo: boolean;
}

/** Segmento como o domínio precisa vê-lo para validar o vínculo com a classe. */
export interface SegmentoAtivoRef {
  readonly id: string;
  readonly classeId: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ativo: boolean;
}

export interface ClasseResumo {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface SegmentoResumo {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/** Ativo persistido — estado completo usado por detalhe, criação e atualização. */
export interface AtivoRegistro {
  readonly id: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: ClasseResumo;
  readonly segmento: SegmentoResumo | null;
  readonly cnpj: string | null;
  readonly administrador: string | null;
  readonly gestor: string | null;
  readonly status: StatusAtivo;
  readonly fonteDados: string | null;
  readonly observacoes: string | null;
  readonly criadoEm: Date;
  readonly atualizadoEm: Date;
}

export interface NovoAtivo {
  readonly usuarioId: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classeId: string;
  readonly segmentoId: string | null;
  readonly cnpj: string | null;
  readonly administrador: string | null;
  readonly gestor: string | null;
  readonly status: StatusAtivo;
  readonly fonteDados: string | null;
  readonly observacoes: string | null;
}

/**
 * Campos editáveis via `PATCH /api/ativos/{id}` (RN-010-3).
 *
 * `undefined` = não alterar; `null` = limpar o campo.
 */
export interface CamposAtualizacao {
  readonly nome?: string;
  readonly segmentoId?: string | null;
  readonly cnpj?: string | null;
  readonly administrador?: string | null;
  readonly gestor?: string | null;
  readonly status?: StatusAtivo;
  readonly fonteDados?: string | null;
  readonly observacoes?: string | null;
}

export interface FiltroAtivos {
  readonly usuarioId: string;
  readonly q?: string;
  readonly classeId?: string;
  readonly segmentoId?: string;
  readonly status?: StatusAtivo;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: OrdenacaoAtivo;
  readonly order: DirecaoOrdem;
}

export interface PaginaAtivos {
  readonly itens: readonly AtivoRegistro[];
  readonly total: number;
}

/** Violação da unicidade `(usuario_id, ticker)` (ERROR_CATALOG.md §4). */
export class AtivoTickerDuplicadoError extends Error {
  constructor() {
    super("Ticker já cadastrado para este usuário.");
    this.name = "AtivoTickerDuplicadoError";
  }
}

export interface AtivoRepositorio {
  buscarClasse(classeId: string): Promise<ClasseAtivoRef | null>;

  buscarSegmento(segmentoId: string): Promise<SegmentoAtivoRef | null>;

  /** Unicidade por usuário; `ignorarId` exclui o próprio ativo numa atualização. */
  existeTicker(usuarioId: string, ticker: string, ignorarId?: string): Promise<boolean>;

  criar(novo: NovoAtivo): Promise<AtivoRegistro>;

  listar(filtro: FiltroAtivos): Promise<PaginaAtivos>;

  /** Busca sempre escopada ao titular; `null` quando é de outro usuário. */
  buscarPorId(usuarioId: string, ativoId: string): Promise<AtivoRegistro | null>;

  /** `null` quando o ativo não pertence ao titular. */
  atualizar(
    usuarioId: string,
    ativoId: string,
    campos: CamposAtualizacao,
  ): Promise<AtivoRegistro | null>;
}
