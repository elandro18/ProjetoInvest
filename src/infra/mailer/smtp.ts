import nodemailer, { type Transporter } from "nodemailer";

import type {
  EmailConta,
  EmailRedefinicaoSenha,
  EmailVerificacao,
  Mailer,
} from "../../modules/conta/mailer";
import { logger } from "../logging/logger";

/**
 * Mailer SMTP (RN-085) — usado quando `EMAIL_SERVER` e `EMAIL_FROM` existem.
 *
 * `EMAIL_SERVER` é a URL de conexão aceita pelo Nodemailer (ex.:
 * `smtp://usuario:senha@host:587`). Falha de envio não derruba cadastro nem
 * redefinição: vira log de erro e o titular pode pedir novo link.
 */

export interface SmtpConfig {
  readonly server: string;
  readonly from: string;
}

const ASSUNTO_VERIFICACAO = "Confirme seu e-mail — Investment Control";

const ASSUNTO_REDEFINICAO = "Redefina sua senha — Investment Control";

function corpoVerificacao(email: EmailConta): string {
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

function corpoRedefinicao(email: EmailConta): string {
  return [
    `Olá, ${email.nome}.`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no Investment Control:",
    email.link,
    "",
    `O link expira em ${email.expiraEm.toISOString()}.`,
    "Se você não solicitou a redefinição, ignore esta mensagem; sua senha permanece a mesma.",
  ].join("\n");
}

export function criarMailerSmtp(config: SmtpConfig, transporte?: Transporter): Mailer {
  const transport = transporte ?? nodemailer.createTransport(config.server);

  async function enviar(
    evento: string,
    destino: EmailConta,
    assunto: string,
    corpo: string,
  ): Promise<void> {
    try {
      await transport.sendMail({
        from: config.from,
        to: destino.para,
        subject: assunto,
        text: corpo,
      });
      logger.info(evento, {});
    } catch (erro) {
      logger.error(`${evento}.falha`, {
        erro: erro instanceof Error ? erro.name : "desconhecido",
      });
    }
  }

  return {
    async enviarVerificacaoEmail(email: EmailVerificacao): Promise<void> {
      await enviar(
        "mailer.verificacao_email.enviado",
        email,
        ASSUNTO_VERIFICACAO,
        corpoVerificacao(email),
      );
    },

    async enviarRedefinicaoSenha(email: EmailRedefinicaoSenha): Promise<void> {
      await enviar(
        "mailer.redefinicao_senha.enviado",
        email,
        ASSUNTO_REDEFINICAO,
        corpoRedefinicao(email),
      );
    },
  };
}
