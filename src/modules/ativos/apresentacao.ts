import type { AtivoRegistro, ClasseResumo, SegmentoResumo, StatusAtivo } from "./repositorio";

/**
 * Forma pública do ativo (API_CONTRACTS.md §3.1–§3.3).
 *
 * `posicao`, `rendimentosAcumulados` e `ultimosPrecos` já fazem parte do
 * contrato, mas nascem vazios nesta feature: posição vem da RN-014, rendimentos
 * da RN-017 e o histórico de preços da coleta da RN-030. "Vazio" nunca vira
 * zero inventado — `posicao: null` e `rendimentosAcumulados: "0.00"` porque a
 * ficha precisa distinguir "sem posição" de "posição zerada".
 */

export interface ClasseApi {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface SegmentoApi {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface AtivoApi {
  readonly id: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: ClasseApi;
  readonly segmento: SegmentoApi | null;
  readonly status: StatusAtivo;
  readonly posicao: null;
}

export interface AtivoDetalheApi extends AtivoApi {
  readonly cnpj: string | null;
  readonly administrador: string | null;
  readonly gestor: string | null;
  readonly fonteDados: string | null;
  readonly observacoes: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly rendimentosAcumulados: string;
  readonly ultimosPrecos: readonly unknown[];
}

function apresentarClasse(classe: ClasseResumo): ClasseApi {
  return { id: classe.id, codigo: classe.codigo, nome: classe.nome };
}

function apresentarSegmento(segmento: SegmentoResumo | null): SegmentoApi | null {
  return segmento === null
    ? null
    : { id: segmento.id, codigo: segmento.codigo, nome: segmento.nome };
}

export function apresentarAtivo(ativo: AtivoRegistro): AtivoApi {
  return {
    id: ativo.id,
    ticker: ativo.ticker,
    nome: ativo.nome,
    classe: apresentarClasse(ativo.classe),
    segmento: apresentarSegmento(ativo.segmento),
    status: ativo.status,
    posicao: null,
  };
}

export function apresentarAtivoDetalhe(ativo: AtivoRegistro): AtivoDetalheApi {
  return {
    ...apresentarAtivo(ativo),
    cnpj: ativo.cnpj,
    administrador: ativo.administrador,
    gestor: ativo.gestor,
    fonteDados: ativo.fonteDados,
    observacoes: ativo.observacoes,
    criadoEm: ativo.criadoEm.toISOString(),
    atualizadoEm: ativo.atualizadoEm.toISOString(),
    rendimentosAcumulados: "0.00",
    ultimosPrecos: [],
  };
}
