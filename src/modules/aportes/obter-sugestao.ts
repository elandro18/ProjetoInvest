import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { AporteRepositorio } from "./repositorio";
import type { SugestaoAporteRegistro } from "./tipos";

/**
 * Detalhe de uma sugestão do histórico (RN-052; RN-052-1; API_CONTRACTS.md §8.4).
 *
 * Somente leitura: devolve o snapshot exatamente como foi persistido (RN-025),
 * com a decisão já registrada (RN-053). Id inexistente e id de outro titular
 * respondem o mesmo `APORTE_NAO_ENCONTRADO` (RN-070) — a resposta nunca
 * confirma a existência de uma sugestão alheia.
 */

export interface ObterSugestaoComando {
  readonly usuarioId: string;
  readonly sugestaoId: string;
}

export interface ObterSugestaoDeps {
  readonly repositorio: AporteRepositorio;
}

export async function obterSugestaoAporte(
  comando: ObterSugestaoComando,
  deps: ObterSugestaoDeps,
): Promise<Result<SugestaoAporteRegistro, AppError>> {
  const registro = await deps.repositorio.buscarPorId(
    comando.usuarioId,
    comando.sugestaoId,
  );

  if (registro === null) {
    return err(errors.aporteNaoEncontrado({ id: comando.sugestaoId }));
  }

  return ok(registro);
}
