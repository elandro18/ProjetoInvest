import { ok, type Result } from "../../lib/result";
import type { AppError } from "../../lib/errors";
import { linkVerificacao, type Mailer } from "./mailer";
import type { ContaRepositorio, ContaResumo } from "./repositorio";
import {
  calcularExpiracao,
  VALIDADE_VERIFICACAO_EMAIL_MS,
  type GerarToken,
} from "./token";

/**
 * Reenvio do e-mail de verificação (RN-085, RN-086).
 *
 * A resposta é sempre a mesma — exista ou não a conta, esteja ela pendente,
 * ativa ou excluída. Só contas `PENDENTE_VERIFICACAO` recebem novo link; as
 * demais recebem silêncio. O token anterior do mesmo tipo é invalidado antes
 * de emitir o novo (janela de reuso mínima).
 */

export const MENSAGEM_REENVIO_NEUTRA =
  "Se o e-mail estiver cadastrado, enviaremos um novo link.";

export interface ReenvioComando {
  readonly email: string;
}

export interface ReenvioDeps {
  readonly repositorio: ContaRepositorio;
  readonly mailer: Mailer;
  readonly gerarToken: GerarToken;
  readonly appUrl: string;
  readonly agora?: () => Date;
}

export interface ReenvioResultado {
  readonly message: string;
}

function contaAptaAoReenvio(conta: ContaResumo | null): conta is ContaResumo {
  return (
    conta !== null && conta.excluidoEm === null && conta.statusConta === "PENDENTE_VERIFICACAO"
  );
}

export async function reenviarVerificacao(
  comando: ReenvioComando,
  deps: ReenvioDeps,
): Promise<Result<ReenvioResultado, AppError>> {
  const agora = deps.agora?.() ?? new Date();
  const email = comando.email.trim().toLowerCase();

  const conta = await deps.repositorio.buscarPorEmail(email);
  if (!contaAptaAoReenvio(conta)) {
    return ok({ message: MENSAGEM_REENVIO_NEUTRA });
  }

  const token = deps.gerarToken();
  const expiraEm = calcularExpiracao(agora, VALIDADE_VERIFICACAO_EMAIL_MS);

  await deps.repositorio.substituirTokenVerificacao({
    usuarioId: conta.id,
    token: { hash: token.hash, expiraEm },
    agora,
  });

  await deps.mailer.enviarVerificacaoEmail({
    para: conta.email,
    nome: conta.nome,
    link: linkVerificacao(deps.appUrl, token.token),
    expiraEm,
  });

  return ok({ message: MENSAGEM_REENVIO_NEUTRA });
}
