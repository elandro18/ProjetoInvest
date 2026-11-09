import type { AuditoriaMovimentacao } from "../../modules/movimentacoes/criar-movimentacao";
import type { MovimentacaoRepositorio } from "../../modules/movimentacoes/repositorio";
import { prisma } from "../db/client";
import { MovimentacaoPrismaRepositorio } from "../db/movimentacao-repositorio";
import { logger } from "../logging/logger";

/**
 * Composition root do módulo de movimentações (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosMovimentacoes {
  readonly repositorio: MovimentacaoRepositorio;
  readonly auditoria: AuditoriaMovimentacao;
}

/**
 * Auditoria da exceção de posição negativa (AC-018b).
 *
 * O logger mascara campos financeiros estruturados; por isso o impacto chega
 * como uma string já formatada e legível — motivo, usuário e instante ficam
 * registrados sem vazar payload.
 */
const auditoria: AuditoriaMovimentacao = {
  registrarPosicaoNegativaConfirmada(dados) {
    logger.warn("movimentacao.posicao_negativa_confirmada", {
      requestId: dados.requestId,
      usuarioId: dados.usuarioId,
      ativoId: dados.ativoId,
      movimentacaoId: dados.movimentacaoId,
      motivo: dados.motivo,
      impacto: dados.impacto,
      instante: dados.instante,
    });
  },
};

export function servicosMovimentacoes(): ServicosMovimentacoes {
  return {
    repositorio: new MovimentacaoPrismaRepositorio(prisma),
    auditoria,
  };
}
