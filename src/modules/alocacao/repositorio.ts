/**
 * Port de persistência das metas de alocação (RN-021, RN-022, RN-082;
 * DATA_MODEL.md §4.9).
 *
 * O domínio não conhece Prisma: o contrato é implementado em
 * `src/infra/db/alocacao-meta-repositorio.ts`. Toda operação recebe `usuarioId`
 * — o isolamento por titular é regra de repositório, nunca do chamador.
 *
 * Vigência: uma linha com `vigenciaFim === null` está vigente; ao substituir o
 * conjunto, todas as linhas vigentes do titular recebem `vigenciaFim = início`
 * e o novo conjunto nasce com `vigenciaInicio = início`. O histórico é o
 * conjunto de linhas já encerradas.
 */

export const ESCOPOS_META = ["CLASSE", "SEGMENTO"] as const;

export type EscopoMeta = (typeof ESCOPOS_META)[number];

export interface ReferenciaClasse {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ordem: number;
  readonly ativo: boolean;
}

export interface ReferenciaSegmento {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly classeId: string;
  readonly ordem: number;
  readonly ativo: boolean;
}

export interface ReferenciasAlocacao {
  readonly classes: readonly ReferenciaClasse[];
  readonly segmentos: readonly ReferenciaSegmento[];
}

/** Meta persistida, com a referência já resolvida para a borda. */
export interface MetaRegistro {
  readonly id: string;
  readonly escopo: EscopoMeta;
  /** `classeId` ou `segmentoId`, conforme o escopo. */
  readonly referenciaId: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ordem: number;
  /** Percentual com 6 casas (`"50.000000"`). */
  readonly percentual: string;
  readonly vigenciaInicio: string;
  readonly vigenciaFim: string | null;
  readonly criadoEm: Date;
}

/** Linha a gravar em um novo conjunto de metas. */
export interface NovaMeta {
  readonly escopo: EscopoMeta;
  readonly referenciaId: string;
  /** Percentual normalizado com 6 casas. */
  readonly percentual: string;
}

export interface AlocacaoMetaRepositorio {
  /** Linhas vigentes (`vigenciaFim === null`) do titular. */
  listarVigentes(usuarioId: string): Promise<readonly MetaRegistro[]>;

  /** Todas as linhas do titular, vigentes e históricas, para montar a consulta. */
  listarTodas(usuarioId: string): Promise<readonly MetaRegistro[]>;

  /** Catálogo de classes e segmentos (ativos e inativos) para validação. */
  listarReferencias(): Promise<ReferenciasAlocacao>;

  /**
   * Cria o conjunto inicial somente se o titular ainda não tem vigência.
   * Idempotente: uma segunda chamada concorrente não duplica o conjunto.
   */
  garantirVigencia(
    usuarioId: string,
    metas: readonly NovaMeta[],
    vigenciaInicio: string,
  ): Promise<void>;

  /**
   * Encerra a vigência corrente e grava o novo conjunto na mesma transação.
   * Ao final, exatamente uma linha fica vigente por referência/escopo.
   */
  substituirVigencia(
    usuarioId: string,
    metas: readonly NovaMeta[],
    vigenciaInicio: string,
  ): Promise<void>;
}
