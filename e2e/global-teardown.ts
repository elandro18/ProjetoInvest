import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { apagarRegistro, lerRegistro } from "./usuario-e2e";

const logSilencioso = { info: () => undefined, error: () => undefined };

/**
 * Limpa o E2E de ativos, renda fixa, movimentações, posições, metas de
 * alocação e limites de concentração (RN-010, RN-014, RN-021, RN-049, RN-057,
 * AC-070).
 *
 * As FKs são `ON DELETE RESTRICT`, então a ordem importa:
 * `rendimento` → `movimentacao` → `posicao_ativo` → `ativo` →
 * `investimento_renda_fixa` → `alocacao_meta` → `limite_concentracao` →
 * `usuario`. Antes de apagar o razão, a referência
 * `posicao_ativo.ultima_movimentacao_id` é desvinculada (também RESTRICT); o
 * cache derivado é removido logo depois do razão que ele referencia. Tokens e
 * aceites caem por cascade. Nada é apagado em massa — só os ids registrados na
 * fixture. As contagens finais são impressas como evidência de banco limpo.
 */
export default async function globalTeardown(): Promise<void> {
  const registro = lerRegistro();

  if (registro.disponivel) {
    loadEnvConfig(process.cwd(), false, logSilencioso);
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();

      const ids = [
        registro.usuarios.a.id,
        registro.usuarios.b.id,
        registro.usuarios.c.id,
      ];
      const dono = { usuarioId: { in: ids } };

      const rendimentos = await prisma.rendimento.deleteMany({ where: dono });

      // `posicao_ativo.ultima_movimentacao_id` é ON DELETE RESTRICT: sem
      // desvincular, o razão abaixo não pode ser apagado.
      await prisma.posicaoAtivo.updateMany({
        where: dono,
        data: { ultimaMovimentacaoId: null },
      });
      const movimentacoes = await prisma.movimentacao.deleteMany({ where: dono });
      const posicoes = await prisma.posicaoAtivo.deleteMany({ where: dono });
      const ativos = await prisma.ativo.deleteMany({ where: dono });
      const rendaFixa = await prisma.investimentoRendaFixa.deleteMany({ where: dono });
      const metas = await prisma.alocacaoMeta.deleteMany({ where: dono });
      // `limite_concentracao.usuario_id` é ON DELETE RESTRICT: sem apagar os
      // limites, a remoção dos titulares abaixo falha.
      const limites = await prisma.limiteConcentracao.deleteMany({ where: dono });
      const usuarios = await prisma.usuario.deleteMany({ where: { id: { in: ids } } });

      const restantes = await Promise.all([
        prisma.rendimento.count(),
        prisma.movimentacao.count(),
        prisma.posicaoAtivo.count(),
        prisma.ativo.count(),
        prisma.investimentoRendaFixa.count(),
        prisma.alocacaoMeta.count(),
        prisma.limiteConcentracao.count(),
        prisma.usuario.count(),
      ]);

      const sobraram = await Promise.all([
        prisma.rendimento.count({ where: dono }),
        prisma.movimentacao.count({ where: dono }),
        prisma.posicaoAtivo.count({ where: dono }),
        prisma.ativo.count({ where: dono }),
        prisma.investimentoRendaFixa.count({ where: dono }),
        prisma.alocacaoMeta.count({ where: dono }),
        prisma.limiteConcentracao.count({ where: dono }),
        prisma.usuario.count({ where: { id: { in: ids } } }),
      ]);

      if (sobraram.some((quantidade) => quantidade !== 0)) {
        throw new Error(
          `dados de teste remanescentes (rendimentos: ${sobraram[0]}, ` +
            `movimentações: ${sobraram[1]}, posições: ${sobraram[2]}, ` +
            `ativos: ${sobraram[3]}, renda fixa: ${sobraram[4]}, ` +
            `metas de alocação: ${sobraram[5]}, limites de concentração: ${sobraram[6]}, ` +
            `usuários: ${sobraram[7]})`,
        );
      }

      process.stdout.write(
        `[e2e] Limpeza: ${rendimentos.count} rendimento(s), ${movimentacoes.count} movimentação(ões), ` +
          `${posicoes.count} posição(ões), ${ativos.count} ativo(s), ${rendaFixa.count} título(s) de renda fixa, ` +
          `${metas.count} meta(s) de alocação, ${limites.count} limite(s) de concentração e ` +
          `${usuarios.count} usuário(s) de teste removidos; ` +
          `restam ${restantes[0]} rendimento(s), ${restantes[1]} movimentação(ões), ` +
          `${restantes[2]} posição(ões), ${restantes[3]} ativo(s), ` +
          `${restantes[4]} título(s) de renda fixa, ${restantes[5]} meta(s) de alocação, ` +
          `${restantes[6]} limite(s) de concentração e ${restantes[7]} usuário(s).\n`,
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
