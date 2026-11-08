import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { hashSenha } from "../src/infra/auth/password";
import {
  emailUsuarioE2E,
  gravarRegistro,
  NOME_USUARIO_E2E,
  SENHA_USUARIO_E2E,
} from "./usuario-e2e";

const logSilencioso = { info: () => undefined, error: () => undefined };

/**
 * Cria o usuário ativado usado pelo E2E de login (RN-085-9).
 *
 * Usa o mesmo `hashSenha` (Argon2id) do runtime para que a senha de teste seja
 * verificada exatamente como uma senha real. Falha de banco não derruba a
 * suíte: grava a fixture como indisponível e o teste de login válido é pulado.
 */
export default async function globalSetup(): Promise<void> {
  loadEnvConfig(process.cwd(), false, logSilencioso);

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    const email = emailUsuarioE2E();
    const senhaHash = await hashSenha(SENHA_USUARIO_E2E);
    const usuario = await prisma.usuario.create({
      data: {
        nome: NOME_USUARIO_E2E,
        email,
        senhaHash,
        statusConta: "ATIVA",
        emailVerificadoEm: new Date(),
      },
      select: { id: true },
    });

    gravarRegistro({
      disponivel: true,
      usuario: { id: usuario.id, nome: NOME_USUARIO_E2E, email, senha: SENHA_USUARIO_E2E },
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    process.stdout.write(
      `[e2e] Usuário de teste não criado (login válido será ignorado): ${motivo}\n`,
    );
    gravarRegistro({ disponivel: false, motivo });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
