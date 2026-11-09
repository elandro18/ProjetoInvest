import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { apagarRegistro, lerRegistro } from "./usuario-e2e";

const logSilencioso = { info: () => undefined, error: () => undefined };

/**
 * Limpa o E2E de ativos (RN-010, AC-070).
 *
 * A FK `ativo.usuario_id` é `ON DELETE RESTRICT`: os ativos do(s) titular(es)
 * de teste são apagados **antes** das contas. Tokens e aceites caem por
 * cascade. Nada é apagado em massa — só os ids registrados na fixture. As
 * contagens finais são impressas como evidência de banco limpo.
 */
export default async function globalTeardown(): Promise<void> {
  const registro = lerRegistro();

  if (registro.disponivel) {
    loadEnvConfig(process.cwd(), false, logSilencioso);
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();

      const ids = [registro.usuarios.a.id, registro.usuarios.b.id];

      const ativos = await prisma.ativo.deleteMany({
        where: { usuarioId: { in: ids } },
      });
      const usuarios = await prisma.usuario.deleteMany({ where: { id: { in: ids } } });

      const [ativosRestantes, usuariosRestantes] = await Promise.all([
        prisma.ativo.count(),
        prisma.usuario.count(),
      ]);

      process.stdout.write(
        `[e2e] Limpeza: ${ativos.count} ativo(s) e ${usuarios.count} usuário(s) de teste removidos; ` +
          `restam ${ativosRestantes} ativo(s) e ${usuariosRestantes} usuário(s).\n`,
      );
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      process.stdout.write(`[e2e] Falha ao limpar dados de teste: ${motivo}\n`);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  apagarRegistro();
}
