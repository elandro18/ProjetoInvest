import type { StatusAtivo } from "../ativos/repositorio";
import type {
  DecisaoUsuario,
  NovaSugestaoAporte,
  ResumoDistribuicaoSugerida,
  SugestaoAporteRegistro,
} from "./tipos";

/**
 * Ports do módulo de aportes (RN-025, RN-052, RN-053; DATA_MODEL.md §4.15).
 *
 * O domínio não conhece Prisma: a leitura de candidatos e a persistência do
 * snapshot são implementadas em `src/infra/db/sugestao-aporte-prisma.ts`.
 * Toda operação recebe `usuarioId` — o isolamento por titular é regra de
 * repositório, nunca do chamador.
 */

/** Paginação do histórico (API_CONTRACTS.md §8.3) — mesmo padrão das demais listas. */
export const PAGE_SIZE_PADRAO = 20;
export const PAGE_SIZE_MAXIMO = 100;

/** Ativo cadastrado pelo titular, insumo do checklist (RN-050). */
export interface CandidatoAporte {
  readonly ativoId: string;
  readonly ticker: string;
  readonly nome: string;
  readonly status: StatusAtivo;
  readonly classeId: string;
  readonly classeCodigo: string;
  readonly segmentoId: string | null;
  readonly segmentoCodigo: string | null;
  /** `true` quando existe posição com quantidade > 0. */
  readonly naCarteira: boolean;
  /** Custo da posição com 2 casas; `"0.00"` sem posição. */
  readonly valorAtual: string;
}

export interface AporteRepositorio {
  /** Todos os ativos do titular, ativos e inativos, ordenados por ticker. */
  listarCandidatos(usuarioId: string): Promise<readonly CandidatoAporte[]>;

  criar(novo: NovaSugestaoAporte): Promise<SugestaoAporteRegistro>;

  /** Busca sempre escopada ao titular; `null` quando é de outro usuário. */
  buscarPorId(usuarioId: string, sugestaoId: string): Promise<SugestaoAporteRegistro | null>;

  /**
   * Histórico do titular (RN-052): ordem fixa `data` desc, paginado e já com o
   * resumo da distribuição sugerida — o snapshot completo fica no detalhe.
   */
  listarHistorico(filtro: FiltroHistoricoAportes): Promise<PaginaSugestoesAporte>;

  /**
   * Registra ou sobrescreve a decisão (RN-053). `null` quando a sugestão não
   * existe ou pertence a outro titular.
   */
  atualizarDecisao(
    usuarioId: string,
    sugestaoId: string,
    decisao: DecisaoUsuario,
    decisaoEm: Date,
    observacoes: string | null,
  ): Promise<SugestaoAporteRegistro | null>;
}

/** Filtro da lista do histórico (RN-052; API_CONTRACTS.md §8.3). */
export interface FiltroHistoricoAportes {
  readonly usuarioId: string;
  /** `YYYY-MM-DD`, inclusivo e aplicado sobre o dia inteiro da sugestão. */
  readonly de?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  readonly ate?: string;
  readonly decisao?: DecisaoUsuario;
  readonly page: number;
  readonly pageSize: number;
}

/** Linha da lista do histórico: sem `ativosAvaliados` nem justificativas. */
export interface ResumoSugestaoAporte {
  readonly id: string;
  readonly data: Date;
  readonly valorDisponivel: string;
  readonly resumo: ResumoDistribuicaoSugerida;
  readonly decisaoUsuario: DecisaoUsuario | null;
  readonly decisaoEm: Date | null;
}

export interface PaginaSugestoesAporte {
  readonly itens: readonly ResumoSugestaoAporte[];
  readonly total: number;
}
