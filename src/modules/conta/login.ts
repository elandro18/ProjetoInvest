import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { ContaRepositorio, StatusConta } from "./repositorio";

/**
 * Autenticação por credenciais (RN-071, RN-085; SECURITY.md §4).
 *
 * A senha é verificada **antes** de revelar qualquer estado da conta: um
 * usuário pendente ou suspenso que erre a senha recebe o mesmo 401 genérico
 * de quem não existe. Só depois da senha correta o status vira resposta
 * específica (403 com `podeReenviar`, 403 suspensa).
 *
 * A conta `EXCLUIDA` responde como credencial inválida — o encerramento não
 * pode ser confirmado por tentativa de login (AC-088b).
 */

export type VerificarSenha = (hashArmazenado: string, senha: string) => Promise<boolean>;

/**
 * Hash Argon2id de referência, usado apenas para equalizar o tempo de
 * resposta quando o e-mail não existe. Nunca corresponde a uma senha real.
 */
export const HASH_SENHA_INEXISTENTE =
  "$argon2id$v=19$m=65536,t=3,p=1$WHW040XLZnVw65F6ykWc4A$ep0gAoNm8r+PUhurvcriNUwxePWKC5w0UA5gp3XCMd8";

export interface LoginComando {
  readonly email: string;
  readonly senha: string;
}

export interface LoginDeps {
  readonly repositorio: ContaRepositorio;
  readonly verificarSenha: VerificarSenha;
}

export interface UsuarioAutenticado {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly statusConta: StatusConta;
  readonly sessionVersion: number;
}

export interface LoginResultado {
  readonly usuario: UsuarioAutenticado;
}

/** Traduz o estado da conta em erro de login, após a senha já validada. */
export function erroDeStatus(statusConta: StatusConta): AppError | null {
  switch (statusConta) {
    case "ATIVA":
      return null;
    case "PENDENTE_VERIFICACAO":
      return errors.authEmailNaoVerificado({ podeReenviar: true });
    case "SUSPENSA":
      return errors.authContaSuspensa();
    case "EXCLUIDA":
      return errors.authCredenciaisInvalidas();
  }
}

export async function autenticar(
  comando: LoginComando,
  deps: LoginDeps,
): Promise<Result<LoginResultado, AppError>> {
  const email = comando.email.trim().toLowerCase();
  const conta = await deps.repositorio.buscarCredenciais(email);

  // Sem conta, verifica um hash de referência para não vazar a existência
  // do e-mail pelo tempo de resposta.
  const senhaConfere = await deps.verificarSenha(
    conta?.senhaHash ?? HASH_SENHA_INEXISTENTE,
    comando.senha,
  );

  if (!senhaConfere || conta === null || conta.excluidoEm !== null) {
    return err(errors.authCredenciaisInvalidas());
  }

  const violacao = erroDeStatus(conta.statusConta);
  if (violacao !== null) {
    return err(violacao);
  }

  return ok({
    usuario: {
      id: conta.id,
      nome: conta.nome,
      email: conta.email,
      statusConta: conta.statusConta,
      sessionVersion: conta.sessionVersion,
    },
  });
}
