import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { ContaRepositorio } from "./repositorio";
import { classificarTokenDeUso } from "./token-uso";
import type { HashToken } from "./token";

/**
 * Verificação de e-mail por token (RN-085).
 *
 * Regras, nesta ordem:
 * 1. token inexistente/hash divergente → `AUTH_TOKEN_INVALIDO` (400);
 * 2. token de outro tipo (redefinição usado aqui) → `AUTH_TOKEN_INVALIDO`;
 * 3. `usadoEm` preenchido → `AUTH_TOKEN_JA_USADO` (409);
 * 4. `expiraEm` no passado → `AUTH_TOKEN_EXPIRADO` (410);
 * 5. consumo do token e ativação da conta na mesma transação.
 *
 * Uso único também é garantido no banco: se duas requisições concorrentes
 * chegarem com o mesmo token, apenas uma consome — a outra recebe 409.
 */

export interface VerificacaoComando {
  readonly token: string;
}

export interface VerificacaoDeps {
  readonly repositorio: ContaRepositorio;
  readonly hashToken: HashToken;
  readonly agora?: () => Date;
}

export interface VerificacaoResultado {
  readonly statusConta: "ATIVA";
  readonly emailVerificadoEm: string;
}

export async function verificarEmail(
  comando: VerificacaoComando,
  deps: VerificacaoDeps,
): Promise<Result<VerificacaoResultado, AppError>> {
  const agora = deps.agora?.() ?? new Date();
  const token = comando.token.trim();

  if (token === "") {
    return err(errors.authTokenInvalido());
  }

  const registro = await deps.repositorio.buscarTokenPorHash(deps.hashToken(token));
  if (registro === null) {
    return err(errors.authTokenInvalido());
  }

  const violacao = classificarTokenDeUso(registro, "VERIFICACAO_EMAIL", agora);
  if (violacao !== null) {
    return err(violacao);
  }

  const ativacao = await deps.repositorio.ativarConta({
    tokenId: registro.id,
    usuarioId: registro.usuarioId,
    agora,
  });

  if (ativacao === null) {
    return err(errors.authTokenJaUsado());
  }

  return ok({
    statusConta: "ATIVA",
    emailVerificadoEm: ativacao.emailVerificadoEm.toISOString(),
  });
}
