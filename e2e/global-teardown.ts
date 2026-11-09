import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { apagarRegistro, lerRegistro } from "./usuario-e2e";

const logSilencioso = { info: () => undefined, error: () => undefined };

/**
 * Limpa o E2E de ativos e renda fixa (RN-010, RN-057, AC-070).
 *
 * As FKs `ativo.usuario_id` e `investimento_renda_fixa.usuario_id` são
 * `ON DELETE RESTRICT`: os dados dos titulares de teste são apagados **antes**
 * das contas. Tokens e aceites caem por cascade. Nada é apagado em massa — só
 * os ids registrados na fixture. As contagens finais são impressas como
 * evidência de banco limpo.
 */
export default async function globalTeardown(): Promise<void> {
  const registro = lerRegistro();

  if (registro.disponivel) {
    loadEnvConfig(process.cwd(), false, logSilencioso);
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();

      const ids = [registro.usuarios.a.id, registro.usuarios.b.id];
      const dono = { usuarioId: { in: ids } };

      const rendaFixa = await prisma.investimentoRendaFixa.deleteMany({ where: dono });
      const ativos = await prisma.ativo.deleteMany({ where: dono });
      const usuarios = await prisma.usuario.deleteMany({ where: { id: { in: ids } } });

      const [rendaFixaRestante, ativosRestantes, usuariosRestantes] = await Promise.all([
        prisma.investimentoRendaFixa.count(),
        prisma.ativo.count(),
        prisma.usuario.count(),
      ]);

      const sobraram = await Promise.all([
        prisma.investimentoRendaFixa.count({ where: dono }),
        prisma.ativo.count({ where: dono }),
        prisma.usuario.count({ where: { id: { in: ids } } }),
      ]);

      if (sobraram.some((quantidade) => quantidade !== 0)) {
        throw new Error(
          `dados de teste remanescentes (renda fixa: ${sobraram[0]}, ` +
            `ativos: ${sobraram[1]}, usuários: ${sobraram[2]})`,
        );
      }

      process.stdout.write(
        `[e2e] Limpeza: ${rendaFixa.count} título(s) de renda fixa, ${ativos.count} ativo(s) e ` +
          `${usuarios.count} usuário(s) de teste removidos; restam ${rendaFixaRestante} título(s) de renda fixa, ` +
          `${ativosRestantes} ativo(s) e ${usuariosRestantes} usuário(s).\n`,
      );
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      process.stdout.write(`[e2e] Falha ao limpar dados de teste: ${motivo}\n`);
      throw erro;
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  apagarRegistro();
}
