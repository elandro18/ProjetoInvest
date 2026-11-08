import { gerarToken, hashToken } from "../auth/token";
import { hashSenha } from "../auth/password";
import { ContaPrismaRepositorio } from "../db/conta-repositorio";
import { prisma } from "../db/client";
import { getMailer } from "../mailer";
import type { Mailer } from "../../modules/conta/mailer";
import type { ContaRepositorio } from "../../modules/conta/repositorio";
import type { GerarToken, HashToken } from "../../modules/conta/token";

/**
 * Composition root do módulo de conta (ARCHITECTURE.md §3).
 *
 * A borda HTTP conhece apenas este arquivo: ela recebe as dependências já
 * concretas e injeta nos casos de uso. Nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosConta {
  readonly repositorio: ContaRepositorio;
  readonly mailer: Mailer;
  readonly hashSenha: (senha: string) => Promise<string>;
  readonly gerarToken: GerarToken;
  readonly hashToken: HashToken;
  readonly appUrl: string;
  readonly agora: () => Date;
}

const APP_URL_PADRAO = "http://localhost:3000";

export function servicosConta(): ServicosConta {
  return {
    repositorio: new ContaPrismaRepositorio(prisma),
    mailer: getMailer(),
    hashSenha,
    gerarToken,
    hashToken,
    appUrl: process.env.APP_URL?.trim() || APP_URL_PADRAO,
    agora: () => new Date(),
  };
}
