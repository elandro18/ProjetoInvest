import type { PrismaClient } from "@prisma/client";

import { dataParaIso, isoParaData } from "../../lib/datas";
import type {
  CarteiraRepositorio,
  DadosCarteira,
  MovimentacaoCarteira,
} from "../../modules/carteira/repositorio";

/**
 * Adaptador Prisma do port `CarteiraRepositorio` (RN-020, RN-023, RN-062,
 * RN-089, RN-091).
 *
 * A leitura do resumo é uma única rodada de consultas por escopo (posições,
 * renda fixa, rendimentos do ano, catálogo de classes e segmentos), nunca por
 * ativo — evita N+1. A agregação e o recorte mensal/anual ficam na função pura
 * `consolidarCarteira`.
 *
 * A evolução consulta o razão de movimentações não canceladas até `ate`; o
 * saldo de renda fixa é o atual, pois não há histórico de saldo na Fase 1.
 */

export class CarteiraPrismaRepositorio implements CarteiraRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async carregarDados(usuarioId: string, hoje: string): Promise<DadosCarteira> {
    const inicioAno = `${hoje.slice(0, 4)}-01-01`;

    const [posicoes, rendaFixa, rendimentos, classes, segmentos] = await Promise.all([
      this.prisma.posicaoAtivo.findMany({
        where: { usuarioId, quantidade: { gt: 0 } },
        select: {
          ativoId: true,
          quantidade: true,
          precoMedio: true,
          custoTotal: true,
          ativo: {
            select: { ticker: true, nome: true, classeId: true, segmentoId: true },
          },
        },
      }),
      this.prisma.investimentoRendaFixa.aggregate({
        where: { usuarioId },
        _sum: { saldoAtual: true },
        _count: { _all: true },
      }),
      this.prisma.rendimento.findMany({
        where: {
          usuarioId,
          dataPagamento: { gte: isoParaData(inicioAno), lte: isoParaData(hoje) },
        },
        select: { dataPagamento: true, valor: true },
      }),
      this.prisma.classeAtivo.findMany({
        select: { id: true, codigo: true, nome: true, ordem: true },
        orderBy: { ordem: "asc" },
      }),
      this.prisma.segmentoAtivo.findMany({
        select: { id: true, codigo: true, nome: true, ordem: true },
        orderBy: [{ ordem: "asc" }, { codigo: "asc" }],
      }),
    ]);

    return {
      posicoes: posicoes.map((posicao) => ({
        ativoId: posicao.ativoId,
        ticker: posicao.ativo.ticker,
        nome: posicao.ativo.nome,
        quantidade: posicao.quantidade.toFixed(8),
        precoMedio: posicao.precoMedio.toFixed(6),
        custoTotal: posicao.custoTotal.toFixed(2),
        classeId: posicao.ativo.classeId,
        segmentoId: posicao.ativo.segmentoId,
      })),
      rendaFixa: {
        saldoTotal: rendaFixa._sum.saldoAtual?.toFixed(2) ?? "0.00",
        quantidadeTitulos: rendaFixa._count._all,
      },
      rendimentos: rendimentos.map((rendimento) => ({
        dataPagamento: dataParaIso(rendimento.dataPagamento),
        valor: rendimento.valor.toFixed(2),
      })),
      classes,
      segmentos,
    };
  }

  async carregarSaldoRendaFixa(usuarioId: string): Promise<string> {
    const rendaFixa = await this.prisma.investimentoRendaFixa.aggregate({
      where: { usuarioId },
      _sum: { saldoAtual: true },
    });

    return rendaFixa._sum.saldoAtual?.toFixed(2) ?? "0.00";
  }

  async listarMovimentacoes(
    usuarioId: string,
    ate: string,
  ): Promise<readonly MovimentacaoCarteira[]> {
    const movimentacoes = await this.prisma.movimentacao.findMany({
      where: {
        usuarioId,
        canceladaEm: null,
        data: { lte: isoParaData(ate) },
      },
      select: {
        id: true,
        ativoId: true,
        tipo: true,
        data: true,
        criadoEm: true,
        quantidade: true,
        valorUnitario: true,
        valorTotal: true,
        custos: true,
      },
      orderBy: [{ data: "asc" }, { criadoEm: "asc" }],
    });

    return movimentacoes.map((movimentacao) => ({
      id: movimentacao.id,
      ativoId: movimentacao.ativoId,
      tipo: movimentacao.tipo,
      data: dataParaIso(movimentacao.data),
      criadoEm: movimentacao.criadoEm,
      quantidade:
        movimentacao.quantidade === null ? null : movimentacao.quantidade.toFixed(8),
      valorUnitario:
        movimentacao.valorUnitario === null ? null : movimentacao.valorUnitario.toFixed(2),
      valorTotal: movimentacao.valorTotal.toFixed(2),
      custos: movimentacao.custos.toFixed(2),
      canceladaEm: null,
    }));
  }
}
