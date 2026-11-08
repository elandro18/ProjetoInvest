import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { apagarRegistro, lerRegistro } from "./usuario-e2e";

const logSilencioso = { info: () => undefined, error: () => undefined };

/**
 * Remove o usuário de teste e a fixture ao fim do E2E (RN-085-9).
 *
 * Os tokens de conta caem por cascade; qualquer outro resíduo do usuário de
 * teste (aceites) também. Nada é apagado em massa: só o id registrado no
 * setup.
 */
export default async function globalTeardown(): Promise<void> {
  const registro = lerRegistro();

  if (registro.disponivel) {
    loadEnvConfig(process.cwd(), false, logSilencioso);
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();
      await prisma.usuario.delete({ where: { id: registro.usuario.id } });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      process.stdout.write(`[e2e] Falha ao limpar usuário de teste: ${motivo}\n`);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  apagarRegistro();
}
