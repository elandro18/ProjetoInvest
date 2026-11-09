import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { hashSenha } from "../src/infra/auth/password";
import { garantirReferencia } from "./referencia-e2e";
import {
  emailUsuarioE2E,
  gravarRegistro,
  nomeUsuarioE2E,
  SENHA_USUARIO_E2E,
  type ChaveUsuarioE2E,
} from "./usuario-e2e";

const logSilencioso = { info: () => undefined, error: () => undefined };

/**
 * Prepara o E2E de ativos, renda fixa, movimentações e alocação
 * (RN-010, RN-021, AC-070).
 *
 * - Garante o catálogo de classes/segmentos (o CI não roda o seed);
 * - cria **três** titulares ativados (A, B e C) no Postgres, com o mesmo
 *   `hashSenha` (Argon2id) do runtime, para o fluxo de cadastro e para o
 *   isolamento entre usuários;
 * - grava a fixture com os três. Falha de banco não derruba a suíte: grava
 *   `disponivel: false` e os testes dependentes são pulados.
 */
export default async function globalSetup(): Promise<void> {
  loadEnvConfig(process.cwd(), false, logSilencioso);

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    await garantirReferencia(prisma);

    const senhaHash = await hashSenha(SENHA_USUARIO_E2E);
    const agora = Date.now();

    const criar = (chave: ChaveUsuarioE2E) =>
      prisma.usuario.create({
        data: {
          nome: nomeUsuarioE2E(chave),
          email: emailUsuarioE2E(chave, agora),
          senhaHash,
          statusConta: "ATIVA",
          emailVerificadoEm: new Date(),
        },
        select: { id: true },
      });

    const [a, b, c] = await prisma.$transaction([
      criar("a"),
      criar("b"),
      criar("c"),
    ]);

    gravarRegistro({
      disponivel: true,
      usuarios: {
        a: {
          id: a.id,
          nome: nomeUsuarioE2E("a"),
          email: emailUsuarioE2E("a", agora),
          senha: SENHA_USUARIO_E2E,
        },
        b: {
          id: b.id,
          nome: nomeUsuarioE2E("b"),
          email: emailUsuarioE2E("b", agora),
          senha: SENHA_USUARIO_E2E,
        },
        c: {
          id: c.id,
          nome: nomeUsuarioE2E("c"),
          email: emailUsuarioE2E("c", agora),
          senha: SENHA_USUARIO_E2E,
        },
      },
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    process.stdout.write(
      `[e2e] Usuários de teste não criados (fluxos autenticados serão ignorados): ${motivo}\n`,
    );
    gravarRegistro({ disponivel: false, motivo });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
