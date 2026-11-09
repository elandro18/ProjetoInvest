import { hojeIso } from "../../lib/datas";
import type { AppError } from "../../lib/errors";
import { type Result } from "../../lib/result";
import { validarEntradaMetas, type EntradaMetas } from "./metas";
import { obterMetas, type ConsultaMetas, type MetasDeps } from "./obter-metas";

/**
 * Substituição do conjunto de metas vigente (RN-021-2; API_CONTRACTS.md §7.2).
 *
 * A validação acontece antes da transação (soma exata por escopo, referências
 * ativas e sem duplicidade). O repositório então encerra a vigência corrente e
 * grava o novo conjunto atomicamente: nunca existe leitura com classes novas e
 * segmentos antigos, ou duas vigências abertas.
 */

export interface SubstituirMetasComando extends EntradaMetas {
  readonly usuarioId: string;
  /** Injetável nos testes; default = hoje UTC. */
  readonly hoje?: string;
}

export async function substituirMetas(
  comando: SubstituirMetasComando,
  deps: MetasDeps,
): Promise<Result<ConsultaMetas, AppError>> {
  const referencias = await deps.repositorio.listarReferencias();
  const validado = validarEntradaMetas(
    { classe: comando.classe, segmento: comando.segmento },
    referencias,
  );
  if (!validado.ok) {
    return validado;
  }

  const hoje = comando.hoje ?? hojeIso();
  await deps.repositorio.substituirVigencia(comando.usuarioId, validado.value, hoje);

  return obterMetas({ usuarioId: comando.usuarioId, hoje }, deps);
}
