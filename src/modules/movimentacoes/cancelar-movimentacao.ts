import { errors } from "../../lib/errors";
import type { AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { posicaoParaPersistida, reconstruirComExcecoes } from "./posicao";
import { mapearErroPosicao } from "./erros";
import type {
  MovimentacaoRegistro,
  MovimentacaoRepositorio,
} from "./repositorio";
import type { Posicao } from "../posicao/tipos";

/**
 * Cancelamento lógico de movimentação (RN-084; API_CONTRACTS.md §4.3).
 *
 * Nunca há delete físico: grava `cancelada_em`/`cancelamento_motivo` e
 * recalcula a posição a partir das movimentações não canceladas na **mesma
 * transação**. A movimentação cancelada continua listável.
 */

export interface CancelarMovimentacaoComando {
  readonly usuarioId: string;
  readonly movimentacaoId: string;
  readonly motivo: string | null;
  readonly agora?: Date;
}

export interface CancelarMovimentacaoDeps {
  readonly repositorio: MovimentacaoRepositorio;
  readonly agora?: () => Date;
}

export interface ResultadoCancelamento {
  readonly movimentacao: MovimentacaoRegistro;
  readonly posicao: Posicao;
}

export async function cancelarMovimentacao(
  comando: CancelarMovimentacaoComando,
  deps: CancelarMovimentacaoDeps,
): Promise<Result<ResultadoCancelamento, AppError>> {
  const motivo = comando.motivo?.trim() ?? "";
  if (motivo.length === 0) {
    return err(errors.movCancelamentoSemMotivo());
  }

  const movimentacao = await deps.repositorio.buscarPorId(
    comando.usuarioId,
    comando.movimentacaoId,
  );
  if (movimentacao === null) {
    return err(errors.movNaoEncontrada());
  }

  if (movimentacao.canceladaEm !== null) {
    return err(errors.movJaCancelada());
  }

  const existentes = await deps.repositorio.listarParaPosicao(
    comando.usuarioId,
    movimentacao.ativo.id,
  );
  const restantes = existentes.filter((item) => item.id !== movimentacao.id);
  const recalculada = reconstruirComExcecoes(restantes);
  if (!recalculada.ok) {
    return err(mapearErroPosicao(recalculada.error));
  }

  const canceladaEm = comando.agora ?? deps.agora?.() ?? new Date();
  const atualizada = await deps.repositorio.cancelar(
    comando.usuarioId,
    movimentacao.id,
    motivo,
    posicaoParaPersistida(recalculada.value),
    canceladaEm,
  );

  if (atualizada === null) {
    return err(errors.movJaCancelada());
  }

  return ok({ movimentacao: atualizada, posicao: recalculada.value });
}
