/**
 * Ports do controle de concentração (RN-049, RN-082; DATA_MODEL.md §4.18).
 *
 * O domínio não conhece Prisma: os contratos são implementados em
 * `src/infra/db/limite-concentracao-prisma.ts` e
 * `src/infra/db/concentracao-prisma.ts`. Toda operação recebe `usuarioId` —
 * o isolamento por titular é regra de repositório, nunca do chamador.
 *
 * Vigência: uma linha com `vigenciaFim === null` está vigente; ao substituir o
 * conjunto, todas as linhas vigentes do titular recebem `vigenciaFim = início`
 * e o novo conjunto nasce com `vigenciaInicio = início`. O histórico é o
 * conjunto de linhas já encerradas.
 */

export const DIMENSOES_CONCENTRACAO = [
  "ATIVO",
  "GESTORA",
  "SEGMENTO",
  "EMISSOR",
  "IMOVEL",
] as const;

export type DimensaoConcentracao = (typeof DIMENSOES_CONCENTRACAO)[number];

export function ehDimensaoConcentracao(valor: string): valor is DimensaoConcentracao {
  return (DIMENSOES_CONCENTRACAO as readonly string[]).includes(valor);
}

/** Limite persistido, com a vigência materializada para o domínio. */
export interface LimiteRegistro {
  readonly id: string;
  readonly dimensao: DimensaoConcentracao;
  /** Gestora, segmento, ticker ou instituição; `null` = default da dimensão. */
  readonly referencia: string | null;
  /** Percentual com 6 casas (`"20.000000"`). */
  readonly percentualMax: string;
  /** `YYYY-MM-DD`. */
  readonly vigenciaInicio: string;
  /** `YYYY-MM-DD`; `null` enquanto vigente. */
  readonly vigenciaFim: string | null;
  readonly criadoEm: Date;
}

/** Linha a gravar em um novo conjunto de limites. */
export interface NovoLimite {
  readonly dimensao: DimensaoConcentracao;
  readonly referencia: string | null;
  /** Percentual normalizado com 6 casas. */
  readonly percentualMax: string;
}

export interface LimiteConcentracaoRepositorio {
  /** Linhas vigentes (`vigenciaFim === null`) do titular. */
  listarVigentes(usuarioId: string): Promise<readonly LimiteRegistro[]>;

  /** Todas as linhas do titular, vigentes e históricas. */
  listarTodas(usuarioId: string): Promise<readonly LimiteRegistro[]>;

  /**
   * Encerra a vigência corrente e grava o novo conjunto na mesma transação.
   * Um conjunto vazio apenas encerra a vigência (remover todos os limites).
   */
  substituirVigencia(
    usuarioId: string,
    limites: readonly NovoLimite[],
    vigenciaInicio: string,
  ): Promise<void>;
}

/** Posição de FII com a referência de gestora e segmento do ativo. */
export interface PosicaoConcentracao {
  /** `ativo.ticker` — referência da dimensão `ATIVO`. */
  readonly ticker: string;
  readonly nome: string;
  /** `ativo.gestor`; texto livre, pode não estar preenchido. */
  readonly gestor: string | null;
  readonly segmentoCodigo: string | null;
  readonly segmentoNome: string | null;
  /** `posicao_ativo.custo_total` com 2 casas (RN-091). */
  readonly valor: string;
}

/** Título de renda fixa — insumo da dimensão `EMISSOR`. */
export interface TituloConcentracao {
  /** `investimento_renda_fixa.instituicao`. */
  readonly instituicao: string;
  /** `investimento_renda_fixa.saldo_atual` com 2 casas (RN-091). */
  readonly saldo: string;
}

export interface DadosConcentracao {
  readonly posicoes: readonly PosicaoConcentracao[];
  readonly titulos: readonly TituloConcentracao[];
}

export interface ConcentracaoRepositorio {
  /** Posições com quantidade > 0 e títulos de renda fixa do titular. */
  carregarDados(usuarioId: string): Promise<DadosConcentracao>;
}
