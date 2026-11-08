import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { linkRedefinicaoSenha, type Mailer } from "./mailer";
import type { ContaRepositorio, ContaResumo } from "./repositorio";
import { senhaAceitavel, type HashSenha } from "./senha";
import {
  calcularExpiracao,
  VALIDADE_REDEFINICAO_SENHA_MS,
  type GerarToken,
  type HashToken,
} from "./token";
import { classificarTokenDeUso } from "./token-uso";

/**
 * Redefinição de senha (RN-085-5, RN-071, RN-086).
 *
 * `solicitarRedefinicaoSenha` responde **sempre** com a mesma mensagem —
 * exista ou não a conta, esteja ela ativa, pendente ou suspensa. Só conta
 * encerrada não recebe token. O token novo invalida os pendentes e expira em
 * 1 h.
 *
 * `redefinirSenha` consome o token de uso único, grava o novo hash Argon2id e
 * incrementa `sessionVersion` na mesma transação: a troca de senha derruba
 * todas as sessões emitidas antes dela.
 */

export const MENSAGEM_REDEFINICAO_NEUTRA = "Se o e-mail estiver cadastrado, enviaremos um link.";

export const MENSAGEM_SENHA_REDEFINIDA = "Senha redefinida.";

export interface EsqueciSenhaComando {
  readonly email: string;
}

export interface EsqueciSenhaDeps {
  readonly repositorio: ContaRepositorio;
  readonly mailer: Mailer;
  readonly gerarToken: GerarToken;
  readonly appUrl: string;
  readonly agora?: () => Date;
}

export interface RedefinicaoSolicitada {
  readonly message: string;
}

export interface RedefinirSenhaComando {
  readonly token: string;
  readonly novaSenha: string;
}

export interface RedefinirSenhaDeps {
  readonly repositorio: ContaRepositorio;
  readonly hashSenha: HashSenha;
  readonly hashToken: HashToken;
  readonly agora?: () => Date;
}

export interface SenhaRedefinida {
  readonly message: string;
}

/** Só conta não encerrada recebe novo token de redefinição. */
function contaAptaAoReset(conta: ContaResumo | null): conta is ContaResumo {
  return conta !== null && conta.excluidoEm === null && conta.statusConta !== "EXCLUIDA";
}

export async function solicitarRedefinicaoSenha(
  comando: EsqueciSenhaComando,
  deps: EsqueciSenhaDeps,
): Promise<Result<RedefinicaoSolicitada, AppError>> {
  const agora = deps.agora?.() ?? new Date();
  const email = comando.email.trim().toLowerCase();

  const conta = await deps.repositorio.buscarPorEmail(email);
  if (!contaAptaAoReset(conta)) {
    return ok({ message: MENSAGEM_REDEFINICAO_NEUTRA });
  }

  const token = deps.gerarToken();
  const expiraEm = calcularExpiracao(agora, VALIDADE_REDEFINICAO_SENHA_MS);

  await deps.repositorio.substituirTokenRedefinicao({
    usuarioId: conta.id,
    token: { hash: token.hash, expiraEm },
    agora,
  });

  await deps.mailer.enviarRedefinicaoSenha({
    para: conta.email,
    nome: conta.nome,
    link: linkRedefinicaoSenha(deps.appUrl, token.token),
    expiraEm,
  });

  return ok({ message: MENSAGEM_REDEFINICAO_NEUTRA });
}

export async function redefinirSenha(
  comando: RedefinirSenhaComando,
  deps: RedefinirSenhaDeps,
): Promise<Result<SenhaRedefinida, AppError>> {
  const agora = deps.agora?.() ?? new Date();
  const token = comando.token.trim();

  if (token === "") {
    return err(errors.authTokenInvalido());
  }

  const registro = await deps.repositorio.buscarTokenPorHash(deps.hashToken(token));
  if (registro === null) {
    return err(errors.authTokenInvalido());
  }

  const violacao = classificarTokenDeUso(registro, "REDEFINICAO_SENHA", agora);
  if (violacao !== null) {
    return err(violacao);
  }

  if (!senhaAceitavel(comando.novaSenha)) {
    return err(errors.authSenhaFraca());
  }

  const senhaHash = await deps.hashSenha(comando.novaSenha);

  const consumido = await deps.repositorio.redefinirSenha({
    tokenId: registro.id,
    usuarioId: registro.usuarioId,
    senhaHash,
    agora,
  });

  if (!consumido) {
    return err(errors.authTokenJaUsado());
  }

  return ok({ message: MENSAGEM_SENHA_REDEFINIDA });
}
