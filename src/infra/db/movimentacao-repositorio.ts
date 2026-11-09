import { Prisma, type PrismaClient } from "@prisma/client";

import { dataParaIso, isoParaData } from "../../lib/datas";
import type { MovimentacaoParaPosicao } from "../../modules/posicao/tipos";
import {
  MovimentacaoIdempotenteError,
  type AtivoMovimentacaoRef,
  type DadosCriacaoMovimentacao,
  type FiltroMovimentacoes,
  type MovimentacaoRegistro,
  type MovimentacaoRepositorio,
  type PaginaMovimentacoes,
  type PosicaoPersistida,
} from "../../modules/movimentacoes/repositorio";

/**
 * Implementação Prisma do port `MovimentacaoRepositorio` (RN-014, RN-084).
 *
 * A criação e o cancelamento rodam em transação interativa: movimentação,
 * rendimento e `posicao_ativo` sempre mudam juntos. O índice único parcial de
 * idempotência (`ux_mov_idempotency`) é aplicado na migration e sinalizado por
 * `MovimentacaoIdempotenteError` quando a corrida acontece.
 */

const MOVIMENTACAO_SELECT = {
  id: true,
  tipo: true,
  data: true,
  quantidade: true,
  valorUnitario: true,
  valorTotal: true,
  custos: true,
  observacoes: true,
  canceladaEm: true,
  cancelamentoMotivo: true,
  idempotencyKey: true,
  criadoEm: true,
  ativo: { select: { id: true, ticker: true } },
} satisfies Prisma.MovimentacaoSelect;

type MovimentacaoSelecionada = Prisma.MovimentacaoGetPayload<{
  select: typeof MOVIMENTACAO_SELECT;
}>;

const POSICAO_PARA_SELECT = {
  id: true,
  tipo: true,
  data: true,
  criadoEm: true,
  quantidade: true,
  valorUnitario: true,
  valorTotal: true,
  custos: true,
} satisfies Prisma.MovimentacaoSelect;

type MovimentacaoPosicaoSelecionada = Prisma.MovimentacaoGetPayload<{
  select: typeof POSICAO_PARA_SELECT;
}>;

function mapear(row: MovimentacaoSelecionada): MovimentacaoRegistro {
  return {
    id: row.id,
    ativo: row.ativo,
    tipo: row.tipo,
    data: dataParaIso(row.data),
    quantidade: row.quantidade === null ? null : row.quantidade.toFixed(8),
    valorUnitario: row.valorUnitario === null ? null : row.valorUnitario.toFixed(2),
    valorTotal: row.valorTotal.toFixed(2),
    custos: row.custos.toFixed(2),
    observacoes: row.observacoes,
    canceladaEm: row.canceladaEm,
    cancelamentoMotivo: row.cancelamentoMotivo,
    idempotencyKey: row.idempotencyKey,
    criadoEm: row.criadoEm,
  };
}

function mapearParaPosicao(row: MovimentacaoPosicaoSelecionada): MovimentacaoParaPosicao {
  return {
    id: row.id,
    tipo: row.tipo,
    data: dataParaIso(row.data),
    criadoEm: row.criadoEm,
    quantidade: row.quantidade === null ? null : row.quantidade.toFixed(8),
    valorUnitario: row.valorUnitario === null ? null : row.valorUnitario.toFixed(2),
    valorTotal: row.valorTotal.toFixed(2),
    custos: row.custos.toFixed(2),
    canceladaEm: null,
  };
}

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

function filtroWhere(filtro: FiltroMovimentacoes): Prisma.MovimentacaoWhereInput {
  const periodo =
    filtro.de !== undefined || filtro.ate !== undefined
      ? {
          data: {
            ...(filtro.de !== undefined ? { gte: isoParaData(filtro.de) } : {}),
            ...(filtro.ate !== undefined ? { lte: isoParaData(filtro.ate) } : {}),
          },
        }
      : {};

  return {
    usuarioId: filtro.usuarioId,
    ...(filtro.ativoId !== undefined ? { ativoId: filtro.ativoId } : {}),
    ...(filtro.tipo !== undefined ? { tipo: filtro.tipo } : {}),
    ...(filtro.incluirCanceladas ? {} : { canceladaEm: null }),
    ...periodo,
  };
}

export class MovimentacaoPrismaRepositorio implements MovimentacaoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarAtivo(
    usuarioId: string,
    ativoId: string,
  ): Promise<AtivoMovimentacaoRef | null> {
    const row = await this.prisma.ativo.findFirst({
      where: { id: ativoId, usuarioId },
      select: { id: true, ticker: true, status: true, classe: { select: { codigo: true } } },
    });

    return row === null
      ? null
      : {
          id: row.id,
          ticker: row.ticker,
          status: row.status,
          classeCodigo: row.classe.codigo,
        };
  }

  async buscarPorIdempotencia(
    usuarioId: string,
    idempotencyKey: string,
  ): Promise<MovimentacaoRegistro | null> {
    const row = await this.prisma.movimentacao.findFirst({
      where: { usuarioId, idempotencyKey },
      select: MOVIMENTACAO_SELECT,
    });

    return row === null ? null : mapear(row);
  }

  async listarParaPosicao(
    usuarioId: string,
    ativoId: string,
  ): Promise<readonly MovimentacaoParaPosicao[]> {
    const rows = await this.prisma.movimentacao.findMany({
      where: { usuarioId, ativoId, canceladaEm: null },
      select: POSICAO_PARA_SELECT,
      orderBy: [{ data: "asc" }, { criadoEm: "asc" }],
    });

    return rows.map(mapearParaPosicao);
  }

  async criar(dados: DadosCriacaoMovimentacao): Promise<MovimentacaoRegistro> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const nova = dados.nova;
        const movimentacao = await tx.movimentacao.create({
          data: {
            usuarioId: nova.usuarioId,
            ativoId: nova.ativoId,
            tipo: nova.tipo,
            data: isoParaData(nova.data),
            quantidade: nova.quantidade,
            valorUnitario: nova.valorUnitario,
            valorTotal: nova.valorTotal,
            custos: nova.custos,
            observacoes: nova.observacoes,
            idempotencyKey: nova.idempotencyKey,
            criadoEm: nova.criadoEm,
          },
          select: MOVIMENTACAO_SELECT,
        });

        if (dados.rendimento !== null) {
          await tx.rendimento.create({
            data: {
              usuarioId: nova.usuarioId,
              ativoId: nova.ativoId,
              tipo: dados.rendimento.tipo,
              dataPagamento: isoParaData(dados.rendimento.dataPagamento),
              competencia: dados.rendimento.competencia,
              valor: dados.rendimento.valor,
              origem: dados.rendimento.origem,
              movimentacaoId: movimentacao.id,
            },
          });
        }

        await this.gravarPosicao(
          tx,
          nova.usuarioId,
          nova.ativoId,
          dados.posicao,
          movimentacao.id,
        );

        return movimentacao;
      });

      return mapear(row);
    } catch (erro) {
      if (dados.nova.idempotencyKey !== null && ehViolacaoDeUnicidade(erro)) {
        throw new MovimentacaoIdempotenteError();
      }
      throw erro;
    }
  }

  async listar(filtro: FiltroMovimentacoes): Promise<PaginaMovimentacoes> {
    const where = filtroWhere(filtro);
    const orderBy: Prisma.MovimentacaoOrderByWithRelationInput[] = [
      { [filtro.sort]: filtro.order },
      ...(filtro.sort === "criadoEm" ? [] : [{ criadoEm: "asc" as const }]),
    ];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.movimentacao.findMany({
        where,
        select: MOVIMENTACAO_SELECT,
        orderBy,
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.movimentacao.count({ where }),
    ]);

    return { itens: rows.map(mapear), total };
  }

  async buscarPorId(
    usuarioId: string,
    movimentacaoId: string,
  ): Promise<MovimentacaoRegistro | null> {
    const row = await this.prisma.movimentacao.findFirst({
      where: { id: movimentacaoId, usuarioId },
      select: MOVIMENTACAO_SELECT,
    });

    return row === null ? null : mapear(row);
  }

  async cancelar(
    usuarioId: string,
    movimentacaoId: string,
    motivo: string,
    posicao: PosicaoPersistida | null,
    canceladaEm: Date,
  ): Promise<MovimentacaoRegistro | null> {
    const row = await this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.movimentacao.updateMany({
        where: { id: movimentacaoId, usuarioId, canceladaEm: null },
        data: { canceladaEm, cancelamentoMotivo: motivo },
      });

      if (atualizada.count === 0) {
        return null;
      }

      const movimentacao = await tx.movimentacao.findUnique({
        where: { id: movimentacaoId },
        select: MOVIMENTACAO_SELECT,
      });

      if (movimentacao === null) {
        return null;
      }

      await this.gravarPosicao(tx, usuarioId, movimentacao.ativo.id, posicao, null);

      return movimentacao;
    });

    return row === null ? null : mapear(row);
  }

  private async gravarPosicao(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    ativoId: string,
    posicao: PosicaoPersistida | null,
    ultimaMovimentacaoId: string | null,
  ): Promise<void> {
    if (posicao === null) {
      // Posição negativa confirmada (RN-018): o cache não é fonte da verdade e
      // o CHECK de `posicao_ativo` proíbe quantidade negativa.
      await tx.posicaoAtivo.deleteMany({ where: { usuarioId, ativoId } });
      return;
    }

    await tx.posicaoAtivo.upsert({
      where: { usuarioId_ativoId: { usuarioId, ativoId } },
      create: {
        usuarioId,
        ativoId,
        quantidade: posicao.quantidade,
        precoMedio: posicao.precoMedio,
        custoTotal: posicao.custoTotal,
        ultimaMovimentacaoId,
      },
      update: {
        quantidade: posicao.quantidade,
        precoMedio: posicao.precoMedio,
        custoTotal: posicao.custoTotal,
        ultimaMovimentacaoId,
        atualizadoEm: new Date(),
      },
    });
  }
}
