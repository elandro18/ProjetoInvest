import { errors, type AppError } from "../../lib/errors";
import type { TipoTokenConta, TokenPersistido } from "./repositorio";

/**
 * Classificação de um token de uso único (RN-086).
 *
 * Verificação de e-mail e redefinição de senha compartilham a mesma ordem de
 * decisão: tipo esperado, estado da conta, uso único e expiração. Manter a
 * regra num só lugar evita que os dois fluxos aceitem tokens diferentes.
 */

export function classificarTokenDeUso(
  registro: TokenPersistido,
  tipoEsperado: TipoTokenConta,
  agora: Date,
): AppError | null {
  if (registro.tipo !== tipoEsperado) {
    return errors.authTokenInvalido();
  }

  if (registro.excluidoEm !== null || registro.statusConta === "EXCLUIDA") {
    return errors.authTokenInvalido();
  }

  if (registro.usadoEm !== null) {
    return errors.authTokenJaUsado();
  }

  if (registro.expiraEm.getTime() <= agora.getTime()) {
    return errors.authTokenExpirado();
  }

  return null;
}
