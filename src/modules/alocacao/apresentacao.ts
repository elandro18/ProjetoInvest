import type { DesviosAlocacao, ItemDesvio } from "./calcular-desvios";
import type { ConsultaMetas, MetasVigentes, PeriodoMetas } from "./obter-metas";
import type { MetaRegistro } from "./repositorio";

/**
 * Forma pública das metas e desvios (API_CONTRACTS.md §7.1–§7.3).
 *
 * O histórico preserva cada conjunto encerrado no mesmo formato do vigente
 * (classe/segmento/vigência), o que permite à UI exibir versões antigas sem
 * um segundo formato. Percentuais e valores saem como string decimal.
 */

export interface MetaClasseApi {
  readonly classeId: string;
  readonly codigo: string;
  readonly percentual: string;
}

export interface MetaSegmentoApi {
  readonly segmentoId: string;
  readonly codigo: string;
  readonly percentual: string;
}

export interface MetasVigentesApi {
  readonly classe: readonly MetaClasseApi[];
  readonly segmento: readonly MetaSegmentoApi[];
  readonly vigenciaInicio: string;
}

export interface PeriodoMetasApi {
  readonly vigenciaInicio: string;
  readonly vigenciaFim: string;
  readonly classe: readonly MetaClasseApi[];
  readonly segmento: readonly MetaSegmentoApi[];
}

export interface MetasApi {
  readonly vigente: MetasVigentesApi;
  readonly historico: readonly PeriodoMetasApi[];
}

function apresentarClasse(meta: MetaRegistro): MetaClasseApi {
  return { classeId: meta.referenciaId, codigo: meta.codigo, percentual: meta.percentual };
}

function apresentarSegmento(meta: MetaRegistro): MetaSegmentoApi {
  return { segmentoId: meta.referenciaId, codigo: meta.codigo, percentual: meta.percentual };
}

export function apresentarVigente(vigente: MetasVigentes): MetasVigentesApi {
  return {
    classe: vigente.classe.map(apresentarClasse),
    segmento: vigente.segmento.map(apresentarSegmento),
    vigenciaInicio: vigente.vigenciaInicio,
  };
}

function apresentarPeriodo(periodo: PeriodoMetas): PeriodoMetasApi {
  return {
    vigenciaInicio: periodo.vigenciaInicio,
    vigenciaFim: periodo.vigenciaFim,
    classe: periodo.classe.map(apresentarClasse),
    segmento: periodo.segmento.map(apresentarSegmento),
  };
}

export function apresentarMetas(consulta: ConsultaMetas): MetasApi {
  return {
    vigente: apresentarVigente(consulta.vigente),
    historico: consulta.historico.map(apresentarPeriodo),
  };
}

export interface DesviosApi {
  readonly baseCalculo: string;
  readonly itens: readonly ItemDesvio[];
}

export function apresentarDesvios(desvios: DesviosAlocacao): DesviosApi {
  return { baseCalculo: desvios.baseCalculo, itens: desvios.itens };
}
