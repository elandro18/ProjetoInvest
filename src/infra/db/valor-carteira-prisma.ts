import type { PrismaClient } from "@prisma/client";

import { agregarValoresCarteira } from "../../modules/carteira/agregar-valores-carteira";
import type { ValorCarteira, ValoresCarteira } from "../../modules/carteira/valor-carteira";

/**
 * Adaptador Prisma do port `ValorCarteira` (RN-020, RN-021, RN-089, RN-091).
 *
 * Lê as posições e a renda fixa do titular e delega a agregação à função pura
 * `agregarValoresCarteira` — assim a regra de negócio é testável sem banco.
 */

export class ValorCarteiraPrisma implements ValorCarteira {
  constructor(private readonly prisma: PrismaClient) {}

  async agregar(usuarioId: string): Promise<ValoresCarteira> {
    const [posicoes, rendaFixa, classes] = await Promise.all([
      this.prisma.posicaoAtivo.findMany({
        where: { usuarioId, quantidade: { gt: 0 } },
        select: {
          custoTotal: true,
          ativo: { select: { classeId: true, segmentoId: true } },
        },
      }),
      this.prisma.investimentoRendaFixa.aggregate({
        where: { usuarioId },
        _sum: { saldoAtual: true },
      }),
      this.prisma.classeAtivo.findMany({
        select: { id: true, codigo: true },
        orderBy: { ordem: "asc" },
      }),
    ]);

    return agregarValoresCarteira({
      posicoes: posicoes.map((posicao) => ({
        classeId: posicao.ativo.classeId,
        segmentoId: posicao.ativo.segmentoId,
        custoTotal: posicao.custoTotal.toFixed(2),
      })),
      saldoRendaFixa: rendaFixa._sum.saldoAtual?.toFixed(2) ?? "0.00",
      classes,
    });
  }
}
