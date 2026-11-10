import { hojeIso } from "../../lib/datas";
import type { AppError } from "../../lib/errors";
import type { Result } from "../../lib/result";
import { validarLimites, type EntradaLimite } from "./limites";
import { obterLimites, type ConsultaLimites, type LimitesDeps } from "./obter-limites";

/**
 * Substituição do conjunto de limites vigente (RN-049-2; API_CONTRACTS.md §12).
 *
 * A validação acontece antes da transação. O repositório então encerra a
 * vigência corrente (`vigenciaFim = hoje`) e grava o novo conjunto
 * (`vigenciaInicio = hoje`) atomicamente: nunca existe leitura com dois
 * conjuntos abertos nem com referência vigente duplicada.
 */

export interface SubstituirLimitesComando {
  readonly usuarioId: string;
  readonly limites: readonly EntradaLimite[];
  /** Injetável nos testes; default = hoje UTC. */
  readonly hoje?: string;
}

export async function substituirLimites(
  comando: SubstituirLimitesComando,
  deps: LimitesDeps,
): Promise<Result<ConsultaLimites, AppError>> {
  const validado = validarLimites(comando.limites);
  if (!validado.ok) {
    return validado;
  }

  const hoje = comando.hoje ?? hojeIso();
  await deps.repositorio.substituirVigencia(comando.usuarioId, validado.value, hoje);

  return obterLimites({ usuarioId: comando.usuarioId }, deps);
}
