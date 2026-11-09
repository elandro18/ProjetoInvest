import type { PrismaClient } from "@prisma/client";

import { dataParaIso, isoParaData } from "../../lib/datas";
import type {
  DashboardRepositorio,
  DividendoBrutoDashboard,
  RendimentoPeriodoDashboard,
} from "../../modules/dashboard/repositorio";

/**
 * Adaptador Prisma do port `DashboardRepositorio` (RN-061, RN-062).
 *
 * O dashboard reutiliza a carteira e os desvios pelos ports existentes; aqui
 * ficam apenas as leituras que eles não expõem: o custo aplicado da renda fixa
 * e as séries de proventos. Toda consulta filtra por `usuarioId`.
 */

export class DashboardPrismaRepositorio implements DashboardRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async somarValorAplicadoRendaFixa(usuarioId: string): Promise<string> {
    const rendaFixa = await this.prisma.investimentoRendaFixa.aggregate({
      where: { usuarioId },
      _sum: { valorAplicado: true },
    });

    return rendaFixa._sum.valorAplicado?.toFixed(2) ?? "0.00";
  }

  async somarRendimentosTotais(usuarioId: string): Promise<string> {
    const rendimentos = await this.prisma.rendimento.aggregate({
      where: { usuarioId },
      _sum: { valor: true },
    });

    return rendimentos._sum.valor?.toFixed(2) ?? "0.00";
  }

  async listarRendimentos(
    usuarioId: string,
    de: string,
    ate: string,
  ): Promise<readonly RendimentoPeriodoDashboard[]> {
    const rendimentos = await this.prisma.rendimento.findMany({
      where: {
        usuarioId,
        dataPagamento: {
          gte: isoParaData(de),
          lte: isoParaData(ate),
        },
      },
      select: { dataPagamento: true, valor: true },
      orderBy: { dataPagamento: "asc" },
    });

    return rendimentos.map((rendimento) => ({
      dataPagamento: dataParaIso(rendimento.dataPagamento),
      valor: rendimento.valor.toFixed(2),
    }));
  }

  async listarDividendos(
    usuarioId: string,
    limite: number,
  ): Promise<readonly DividendoBrutoDashboard[]> {
    if (limite <= 0) {
      return [];
    }

    const dividendos = await this.prisma.rendimento.findMany({
      where: { usuarioId },
      select: {
        dataPagamento: true,
        valor: true,
        ativo: { select: { ticker: true } },
      },
      orderBy: [{ dataPagamento: "desc" }, { criadoEm: "desc" }],
      take: limite,
    });

    return dividendos.map((dividendo) => ({
      dataPagamento: dataParaIso(dividendo.dataPagamento),
      ticker: dividendo.ativo.ticker,
      valor: dividendo.valor.toFixed(2),
    }));
  }
}
