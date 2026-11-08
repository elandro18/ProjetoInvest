import type { EmailVerificacao, Mailer } from "../../modules/conta/mailer";
import { logger } from "../logging/logger";

/**
 * Mailer de desenvolvimento (RN-085): imprime o link de verificação no log
 * estruturado. É o padrão quando `EMAIL_SERVER`/`EMAIL_FROM` não existem.
 *
 * O link é o único dado sensível aqui e é intencional: sem ele o fluxo local
 * fica inutilizável. O logger mascara chaves chamadas `token`/`senha`; o campo
 * `link` é permitido por ser exatamente o que o desenvolvedor precisa ver.
 */
export function criarMailerConsole(): Mailer {
  return {
    async enviarVerificacaoEmail(email: EmailVerificacao): Promise<void> {
      logger.info("mailer.verificacao_email.dev", {
        para: email.para,
        nome: email.nome,
        link: email.link,
        expiraEm: email.expiraEm.toISOString(),
      });
    },
  };
}
