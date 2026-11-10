import type { StatusAtivo } from "../ativos/repositorio";
import type {
  DecisaoUsuario,
  NovaSugestaoAporte,
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
