import type { Mailer } from "../../modules/conta/mailer";
import { criarMailerConsole } from "./console";
import { criarMailerSmtp } from "./smtp";

/**
 * Seleção do mailer por ambiente (RN-085).
 *
 * Com `EMAIL_SERVER` + `EMAIL_FROM` definidos, envia por SMTP; sem eles,
 * imprime o link no log (desenvolvimento e CI). A instância é criada uma vez
 * por processo para não recriar o pool SMTP a cada requisição.
 */

let instancia: Mailer | null = null;

export function getMailer(): Mailer {
  if (instancia !== null) {
    return instancia;
  }

  const server = process.env.EMAIL_SERVER?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  instancia =
    server !== undefined && server !== "" && from !== undefined && from !== ""
      ? criarMailerSmtp({ server, from })
      : criarMailerConsole();

  return instancia;
}
