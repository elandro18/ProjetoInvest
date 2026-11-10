import type { PrismaClient } from "@prisma/client";

import type {
  ConcentracaoRepositorio,
  DadosConcentracao,
} from "../../modules/risco/repositorio";

/**
 * Adaptador Prisma do port `ConcentracaoRepositorio` (RN-049-3, RN-089, RN-091).
 *
 * Lê, em duas consultas por titular, as posições de FII (com gestora e
 * segmento do ativo) e os títulos de renda fixa (instituição e saldo). A
 * agregação e o percentual ficam na função pura `calcularConcentracao`.
 */
export class ConcentracaoPrismaRepositorio implements ConcentracaoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async carregarDados(usuarioId: string): Promise<DadosConcentracao> {
    const [posicoes, titulos] = await Promise.all([
      this.prisma.posicaoAtivo.findMany({
        where: { usuarioId, quantidade: { gt: 0 } },
        select: {
          custoTotal: true,
          ativo: {
            select: {
              ticker: true,
              nome: true,
              gestor: true,
              segmento: { select: { codigo: true, nome: true } },
            },
          },
        },
      }),
      this.prisma.investimentoRendaFixa.findMany({
        where: { usuarioId },
        select: { instituicao: true, saldoAtual: true },
      }),
    ]);

    return {
      posicoes: posicoes.map((posicao) => ({
        ticker: posicao.ativo.ticker,
        nome: posicao.ativo.nome,
        gestor: posicao.ativo.gestor,
        segmentoCodigo: posicao.ativo.segmento?.codigo ?? null,
        segmentoNome: posicao.ativo.segmento?.nome ?? null,
        valor: posicao.custoTotal.toFixed(2),
      })),
      titulos: titulos.map((titulo) => ({
        instituicao: titulo.instituicao,
        saldo: titulo.saldoAtual.toFixed(2),
      })),
    };
  }
}
