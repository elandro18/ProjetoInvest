import type { ConcentracaoCalculada, DimensaoCalculada } from "./concentracao";
import type { ConsultaLimites } from "./obter-limites";
import type { LimiteRegistro } from "./repositorio";

/**
 * Forma pública dos limites e da concentração (API_CONTRACTS.md §12–§12.1).
 *
 * Percentuais saem como string decimal com 6 casas; o histórico acrescenta
 * `vigenciaFim` à mesma forma do vigente, para a UI não precisar de um segundo
 * formato.
 */

export interface LimiteApi {
  readonly dimensao: string;
  readonly referencia: string | null;
  readonly percentualMax: string;
  readonly vigenciaInicio: string;
}

export interface LimiteHistoricoApi extends LimiteApi {
  readonly vigenciaFim: string;
}

export interface LimitesApi {
  readonly vigente: readonly LimiteApi[];
  readonly historico: readonly LimiteHistoricoApi[];
}

function apresentarLimite(limite: LimiteRegistro): LimiteApi {
  return {
    dimensao: limite.dimensao,
    referencia: limite.referencia,
    percentualMax: limite.percentualMax,
    vigenciaInicio: limite.vigenciaInicio,
  };
}

export function apresentarVigentes(vigentes: readonly LimiteRegistro[]): LimiteApi[] {
  return vigentes.map(apresentarLimite);
}

export function apresentarLimites(consulta: ConsultaLimites): LimitesApi {
  return {
    vigente: apresentarVigentes(consulta.vigente),
    historico: consulta.historico.map((limite) => ({
      ...apresentarLimite(limite),
      vigenciaFim: limite.vigenciaFim ?? "",
    })),
  };
}

export interface ConcentracaoApi {
  readonly baseCalculo: string;
  readonly dimensoes: readonly DimensaoCalculada[];
}

export function apresentarConcentracao(
  concentracao: ConcentracaoCalculada,
): ConcentracaoApi {
  return {
    baseCalculo: concentracao.baseCalculo,
    dimensoes: concentracao.dimensoes,
  };
}
