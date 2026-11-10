import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { AporteRepositorio } from "./repositorio";
import {
  ehDecisaoUsuario,
  type SugestaoAporteRegistro,
} from "./tipos";

/**
 * Registro da decisão do titular (RN-053; RN-025-5; API_CONTRACTS.md §8.3).
 *
 * A sugestão nunca é apagada: a decisão é sobrescrita com nova data quando o
 * titular muda de ideia. A observação opcional acompanha a decisão e é gravada
 * em `observacoes_decisao`; ausente ou vazia vira `null`.
 */

export interface RegistrarDecisaoComando {
  readonly usuarioId: string;
  readonly sugestaoId: string;
  readonly decisao: string;
  readonly observacoes?: string;
}

export interface RegistrarDecisaoDeps {
  readonly repositorio: AporteRepositorio;
  /** Injetável nos testes; default = agora. */
  readonly agora?: Date;
}

export async function registrarDecisaoAporte(
  comando: RegistrarDecisaoComando,
  deps: RegistrarDecisaoDeps,
): Promise<Result<SugestaoAporteRegistro, AppError>> {
  const decisao = comando.decisao.trim();

  if (!ehDecisaoUsuario(decisao)) {
    return err(errors.aporteDecisaoInvalida({ decisao: comando.decisao }));
  }

  const observacoes = comando.observacoes?.trim();
  const observacoesDecisao =
    observacoes === undefined || observacoes.length === 0 ? null : observacoes;

  const registro = await deps.repositorio.atualizarDecisao(
    comando.usuarioId,
    comando.sugestaoId,
    decisao,
    deps.agora ?? new Date(),
    observacoesDecisao,
  );

  if (registro === null) {
    return err(errors.aporteNaoEncontrado({ id: comando.sugestaoId }));
  }

  return ok(registro);
}
