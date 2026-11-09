import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { AtivoRegistro, AtivoRepositorio } from "./repositorio";

/**
 * Detalhe de ativo (RN-010-3; API_CONTRACTS.md §3.3).
 *
 * Ativo de outro titular é indistinguível de inexistente: sempre 404, nunca
 * 403 — o identificador não deve confirmar a existência de dados alheios.
 */

export interface ObterAtivoComando {
  readonly usuarioId: string;
  readonly ativoId: string;
}

export interface ObterAtivoDeps {
  readonly repositorio: AtivoRepositorio;
}

export async function obterAtivo(
  comando: ObterAtivoComando,
  deps: ObterAtivoDeps,
): Promise<Result<AtivoRegistro, AppError>> {
  const ativo = await deps.repositorio.buscarPorId(comando.usuarioId, comando.ativoId);
  return ativo === null ? err(errors.ativoNaoEncontrado()) : ok(ativo);
}
