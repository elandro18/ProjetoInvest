import nodemailer, { type Transporter } from "nodemailer";

import type { EmailVerificacao, Mailer } from "../../modules/conta/mailer";
import { logger } from "../logging/logger";

/**
 * Mailer SMTP (RN-085) — usado quando `EMAIL_SERVER` e `EMAIL_FROM` existem.
 *
 * `EMAIL_SERVER` é a URL de conexão aceita pelo Nodemailer (ex.:
 * `smtp://usuario:senha@host:587`). Falha de envio não derruba o cadastro:
 * vira log de erro e o titular pode pedir reenvio.
 */

export interface SmtpConfig {
  readonly server: string;
  readonly from: string;
}

const ASSUNTO = "Confirme seu e-mail — Investment Control";

function corpoTexto(email: EmailVerificacao): string {
  return [
    `Olá, ${email.nome}.`,
    "",
    "Confirme seu e-mail para ativar sua conta no Investment Control:",
    email.link,
    "",
    `O link expira em ${email.expiraEm.toISOString()}.`,
    "Se você não criou esta conta, ignore esta mensagem.",
  ].join("\n");
}

export function criarMailerSmtp(config: SmtpConfig, transporte?: Transporter): Mailer {
  const transport = transporte ?? nodemailer.createTransport(config.server);

  return {
    async enviarVerificacaoEmail(email: EmailVerificacao): Promise<void> {
      try {
        await transport.sendMail({
          from: config.from,
          to: email.para,
          subject: ASSUNTO,
          text: corpoTexto(email),
        });
        logger.info("mailer.verificacao_email.enviado", {});
      } catch (erro) {
        logger.error("mailer.verificacao_email.falha", {
          erro: erro instanceof Error ? erro.name : "desconhecido",
        });
      }
    },
  };
}
