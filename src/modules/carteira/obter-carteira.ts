import { hojeIsoSaoPaulo } from "../../lib/datas";
import type { AppError } from "../../lib/errors";
import { ok, type Result } from "../../lib/result";
import {
  consolidarCarteira,
  type CarteiraConsolidada,
} from "./consolidar-carteira";
import type { CarteiraRepositorio } from "./repositorio";

/**
 * Caso de uso da carteira consolidada (RN-020, RN-023, RN-089, RN-091;
 * API_CONTRACTS.md §5.1).
 *
 * A data de referência do recorte mensal/anual vem do calendário de São Paulo
 * (RN-020), não do UTC do processo. A divergência entre a soma das classes e
 * o patrimônio total é registrada pelo adaptador de auditoria injetado pelo
 * container — o domínio não conhece logger.
 */

export interface InconsistenciaCarteira {
  readonly usuarioId: string;
  readonly patrimonioTotal: string;
  readonly somaClasses: string;
  readonly divergencia: string;
  readonly tolerancia: string;
}

export type RegistrarInconsistenciaCarteira = (dados: InconsistenciaCarteira) => void;

export interface ObterCarteiraComando {
  readonly usuarioId: string;
}

export interface ObterCarteiraDeps {
  readonly repositorio: CarteiraRepositorio;
  readonly registrarInconsistencia?: RegistrarInconsistenciaCarteira;
  /** Injetável nos testes; default = agora. */
  readonly agora?: Date;
}

export async function obterCarteira(
  comando: ObterCarteiraComando,
  deps: ObterCarteiraDeps,
): Promise<Result<CarteiraConsolidada, AppError>> {
  const agora = deps.agora ?? new Date();
  const hoje = hojeIsoSaoPaulo(agora);
  const dados = await deps.repositorio.carregarDados(comando.usuarioId, hoje);

  const carteira = consolidarCarteira({
    ...dados,
    dataReferencia: hoje,
    atualizadoEm: agora.toISOString(),
  });

  if (!carteira.consistente) {
    deps.registrarInconsistencia?.({
      usuarioId: comando.usuarioId,
      patrimonioTotal: carteira.resumo.patrimonioTotal,
      somaClasses: carteira.diagnostico.somaClasses,
      divergencia: carteira.diagnostico.divergencia,
      tolerancia: carteira.diagnostico.tolerancia,
    });
  }

  return ok(carteira);
}
