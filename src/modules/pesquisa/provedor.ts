/**
 * Port de domínio da camada de provedores de dados (ARCHITECTURE.md §5).
 *
 * ADR-004: este arquivo é domínio puro — não importa `next/*`,
 * `@prisma/client` nem SDK de provedor. As implementações concretas vivem
 * em `src/infra/providers/**` (RN-031, RN-033).
 */

/** Capacidades que um provedor pode declarar (ARCHITECTURE.md §5.1). */
export const CAPACIDADES = [
  "cadastro",
  "cotacao",
  "historico-preco",
  "dividendos",
  "indicadores",
  "informes",
  "composicao",
  "renda-fixa",
] as const;

export type Capacidade = (typeof CAPACIDADES)[number];

/** Origem/qualidade do dado entregue ao domínio (API_CONTRACTS.md §1.3). */
export const STATUS_DADO = ["OFICIAL", "MERCADO", "ESTIMADO", "HISTORICO", "INDISPONIVEL"] as const;

export type StatusDado = (typeof STATUS_DADO)[number];

/**
 * Valor normalizado com proveniência obrigatória (RN-003).
 * `dataReferencia`/`coletadoEm` são strings ISO (date/datetime) para
 * atravessar a borda HTTP sem depender de `Date` do runtime.
 */
export interface DadoProveniente<T> {
  readonly valor: T;
  readonly fonte: string;
  readonly provedorId: string;
  readonly dataReferencia: string;
  readonly coletadoEm: string;
  readonly statusDado: StatusDado;
}

/**
 * Contrato que todo provedor de dados implementa.
 *
 * As operações concretas (ex.: `obterCotacao`) chegam com os adapters das
 * features de pesquisa (RN-029/RN-031/RN-033); aqui fica apenas o que o
 * registry precisa para resolver por capacidade.
 */
export interface ProvedorDados {
  readonly nome: string;
  readonly capacidades: ReadonlySet<Capacidade>;
  suporta(capacidade: Capacidade): boolean;
}

/**
 * Leitor do histórico local usado no fallback da RN-073.
 *
 * A implementação real (consulta a `historico_*`) entra na RN-033; o port
 * existe desde a fundação para que a orquestração de pesquisa dependa só
 * da abstração.
 */
export interface HistoricoReader {
  buscarUltimo<T>(recurso: string, capacidade: Capacidade): Promise<DadoProveniente<T> | null>;
}

const CAPACIDADES_SET: ReadonlySet<string> = new Set(CAPACIDADES);

/** Type guard para valores vindos de configuração (`provedor_dados.capacidades`). */
export function isCapacidade(valor: unknown): valor is Capacidade {
  return typeof valor === "string" && CAPACIDADES_SET.has(valor);
}
