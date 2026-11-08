/**
 * Port de envio de e-mail de conta (RN-085).
 *
 * O domínio conhece apenas o contrato; as implementações vivem em
 * `src/infra/mailer/**` e são escolhidas por variável de ambiente.
 *
 * Contrato de falha: `enviarVerificacaoEmail` é *best-effort*. A implementação
 * registra o erro e resolve — o cadastro não pode falhar porque o provedor de
 * e-mail está fora, já que o titular pode pedir reenvio depois.
 */

export interface EmailVerificacao {
  readonly para: string;
  readonly nome: string;
  readonly link: string;
  readonly expiraEm: Date;
}

export interface Mailer {
  enviarVerificacaoEmail(email: EmailVerificacao): Promise<void>;
}

/** Link público de verificação (`/verificar-email?token=…`). */
export function linkVerificacao(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/verificar-email?token=${encodeURIComponent(token)}`;
}
