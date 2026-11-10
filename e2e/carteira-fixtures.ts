import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

/**
 * Apoio de banco para o E2E da carteira (RN-020-4).
 *
 * A tela e a API não expõem criação de rendimento nem de posição em massa;
 * por isso estes cenários preparam o estado diretamente no Postgres, sempre
 * com o titular da fixture — nunca dado real. A limpeza respeita a ordem das
 * FKs `ON DELETE RESTRICT` (rendimento → posição desvinculada → movimentação →
 * posição → ativo → renda fixa → limite de concentração), a mesma do
 * `globalTeardown`.
 */

const logSilencioso = { info: () => undefined, error: () => undefined };

/** Abre o Prisma no processo do Playwright carregando o `.env` local. */
export function abrirPrisma(): PrismaClient {
  loadEnvConfig(process.cwd(), false, logSilencioso);
  return new PrismaClient();
}

/**
 * Remove os dados de investimento do titular: razão, cache de posição,
 * rendimentos, ativos e títulos de renda fixa. Metas de alocação não são
 * tocadas (pertencem ao fluxo da RN-021).
 */
export async function limparDadosInvestimento(
  prisma: PrismaClient,
  usuarioId: string,
): Promise<void> {
  await prisma.rendimento.deleteMany({ where: { usuarioId } });

  // `posicao_ativo.ultima_movimentacao_id` é RESTRICT: sem desvincular, o
  // razão não pode ser apagado.
  await prisma.posicaoAtivo.updateMany({
    where: { usuarioId },
    data: { ultimaMovimentacaoId: null },
  });
  await prisma.movimentacao.deleteMany({ where: { usuarioId } });
  await prisma.posicaoAtivo.deleteMany({ where: { usuarioId } });
  await prisma.ativo.deleteMany({ where: { usuarioId } });
  await prisma.investimentoRendaFixa.deleteMany({ where: { usuarioId } });
}

/**
 * Remove os limites de concentração do titular (RN-049).
 *
 * `limite_concentracao.usuario_id` é `ON DELETE RESTRICT`: sem esta limpeza, o
 * titular não pode ser apagado. A vigência é versionada, então o `deleteMany`
 * remove vigentes e histórico de uma vez.
 */
export async function limparLimitesConcentracao(
  prisma: PrismaClient,
  usuarioId: string,
): Promise<void> {
  await prisma.limiteConcentracao.deleteMany({ where: { usuarioId } });
}

/** Apaga o titular de performance e todo dado de investimento dele. */
export async function apagarUsuarioDePerformance(
  prisma: PrismaClient,
  usuarioId: string,
): Promise<void> {
  await limparDadosInvestimento(prisma, usuarioId);
  await prisma.alocacaoMeta.deleteMany({ where: { usuarioId } });
  await limparLimitesConcentracao(prisma, usuarioId);
  // `sugestao_aporte.usuario_id` é `ON DELETE RESTRICT` (RN-025).
  await prisma.sugestaoAporte.deleteMany({ where: { usuarioId } });
  await prisma.tokenConta.deleteMany({ where: { usuarioId } });
  await prisma.aceiteLegal.deleteMany({ where: { usuarioId } });
  await prisma.usuario.deleteMany({ where: { id: usuarioId } });
}
