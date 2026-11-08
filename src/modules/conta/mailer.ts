/**
 * Port de envio de e-mail de conta (RN-085).
 *
 * O domínio conhece apenas o contrato; as implementações vivem em
 * `src/infra/mailer/**` e são escolhidas por variável de ambiente.
 *
 * Contrato de falha: os envios são *best-effort*. A implementação registra o
 * erro e resolve — o cadastro/redefinição não pode falhar porque o provedor de
 * e-mail está fora.
 */

/** Dados comuns aos e-mails de conta: link opaco de uso único. */
export interface EmailConta {
  readonly para: string;
  readonly nome: string;
  readonly link: string;
  readonly expiraEm: Date;
}

export type EmailVerificacao = EmailConta;

export type EmailRedefinicaoSenha = EmailConta;

export interface Mailer {
  enviarVerificacaoEmail(email: EmailVerificacao): Promise<void>;
  enviarRedefinicaoSenha(email: EmailRedefinicaoSenha): Promise<void>;
}

/** Link público de verificação (`/verificar-email?token=…`). */
export function linkVerificacao(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/verificar-email?token=${encodeURIComponent(token)}`;
}

/** Link público de redefinição (`/redefinir-senha?token=…`). */
export function linkRedefinicaoSenha(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
}
