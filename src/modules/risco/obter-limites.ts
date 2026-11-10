import type { AppError } from "../../lib/errors";
import { ok, type Result } from "../../lib/result";
import {
  DIMENSOES_CONCENTRACAO,
  type DimensaoConcentracao,
  type LimiteConcentracaoRepositorio,
  type LimiteRegistro,
} from "./repositorio";

/**
 * Leitura dos limites de concentração (RN-049-2; API_CONTRACTS.md §12).
 *
 * Não existe limite default: sem configuração, `vigente` é vazio e a
 * concentração não gera alerta (decisão registrada na análise da RN-049).
 * O histórico preserva cada linha encerrada, com `vigenciaFim`.
 */

export interface ConsultaLimites {
  readonly vigente: readonly LimiteRegistro[];
  readonly historico: readonly LimiteRegistro[];
}

export interface ObterLimitesComando {
  readonly usuarioId: string;
}

export interface LimitesDeps {
  readonly repositorio: LimiteConcentracaoRepositorio;
}

function posicaoDimensao(dimensao: DimensaoConcentracao): number {
  return DIMENSOES_CONCENTRACAO.indexOf(dimensao);
}

function compararReferencia(a: LimiteRegistro, b: LimiteRegistro): number {
  return (a.referencia ?? "").localeCompare(b.referencia ?? "");
}

export function montarConsulta(linhas: readonly LimiteRegistro[]): ConsultaLimites {
  const vigente = linhas
    .filter((linha) => linha.vigenciaFim === null)
    .sort(
      (a, b) => posicaoDimensao(a.dimensao) - posicaoDimensao(b.dimensao) ||
        compararReferencia(a, b),
    );

  const historico = linhas
    .filter((linha) => linha.vigenciaFim !== null)
    .sort(
      (a, b) => (b.vigenciaFim ?? "").localeCompare(a.vigenciaFim ?? "") ||
        posicaoDimensao(a.dimensao) - posicaoDimensao(b.dimensao) ||
        compararReferencia(a, b),
    );

  return { vigente, historico };
}

export async function obterLimites(
  comando: ObterLimitesComando,
  deps: LimitesDeps,
): Promise<Result<ConsultaLimites, AppError>> {
  const linhas = await deps.repositorio.listarTodas(comando.usuarioId);
  return ok(montarConsulta(linhas));
}
