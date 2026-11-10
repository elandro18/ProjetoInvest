import { Prisma, type PrismaClient } from "@prisma/client";

import { isoParaData } from "../../lib/datas";
import type {
  AporteRepositorio,
  CandidatoAporte,
  FiltroHistoricoAportes,
  PaginaSugestoesAporte,
  ResumoSugestaoAporte,
} from "../../modules/aportes/repositorio";
import {
  resumirDistribuicaoSugerida,
  type AtivoAvaliado,
  type DecisaoUsuario,
  type DistribuicaoAtual,
  type DistribuicaoSugerida,
  type NovaSugestaoAporte,
  type SugestaoAporteRegistro,
} from "../../modules/aportes/tipos";

/**
 * Implementação Prisma dos ports do módulo de aportes (RN-025, RN-052, RN-053;
 * DATA_MODEL.md §4.15).
 *
 * O snapshot JSONB é gravado exatamente no formato do contrato; na leitura ele
 * é reconvertido para os tipos do domínio. O CHECK de valor > 0 e o índice
 * `ix_sug_usuario_data` vivem na migration `sugestoes_aporte`.
 */

const SUGESTAO_SELECT = {
  id: true,
  usuarioId: true,
  data: true,
  valorDisponivel: true,
  distribuicaoAtual: true,
  distribuicaoSugerida: true,
  ativosAvaliados: true,
  justificativas: true,
  alertas: true,
  decisaoUsuario: true,
  decisaoEm: true,
  observacoesDecisao: true,
} satisfies Prisma.SugestaoAporteSelect;

type SugestaoSelecionada = Prisma.SugestaoAporteGetPayload<{
  select: typeof SUGESTAO_SELECT;
}>;

function mapear(row: SugestaoSelecionada): SugestaoAporteRegistro {
  return {
    id: row.id,
    usuarioId: row.usuarioId,
    data: row.data,
    valorDisponivel: row.valorDisponivel.toFixed(2),
    distribuicaoAtual: row.distribuicaoAtual as unknown as DistribuicaoAtual,
    distribuicaoSugerida: row.distribuicaoSugerida as unknown as DistribuicaoSugerida,
    ativosAvaliados: row.ativosAvaliados as unknown as readonly AtivoAvaliado[],
    justificativas: row.justificativas as unknown as readonly string[],
    alertas: row.alertas as unknown as readonly string[],
    decisaoUsuario: row.decisaoUsuario,
    decisaoEm: row.decisaoEm,
    observacoesDecisao: row.observacoesDecisao,
  };
}

/** Lista do histórico: só o necessário para a linha (RN-052, decisão 5). */
const RESUMO_SELECT = {
  id: true,
  data: true,
  valorDisponivel: true,
  distribuicaoSugerida: true,
  decisaoUsuario: true,
  decisaoEm: true,
} satisfies Prisma.SugestaoAporteSelect;

type ResumoSelecionado = Prisma.SugestaoAporteGetPayload<{
  select: typeof RESUMO_SELECT;
}>;

function mapearResumo(row: ResumoSelecionado): ResumoSugestaoAporte {
  return {
    id: row.id,
    data: row.data,
    valorDisponivel: row.valorDisponivel.toFixed(2),
    resumo: resumirDistribuicaoSugerida(
      row.distribuicaoSugerida as unknown as DistribuicaoSugerida,
    ),
    decisaoUsuario: row.decisaoUsuario,
    decisaoEm: row.decisaoEm,
  };
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * `data` é `timestamptz`: `de` começa na meia-noite UTC do dia e `ate` é
 * inclusivo, com limite exclusivo no início do dia seguinte.
 */
function filtroPeriodo(
  filtro: FiltroHistoricoAportes,
): Prisma.SugestaoAporteWhereInput {
  if (filtro.de === undefined && filtro.ate === undefined) {
    return {};
  }

  return {
    data: {
      ...(filtro.de === undefined ? {} : { gte: isoParaData(filtro.de) }),
      ...(filtro.ate === undefined
        ? {}
        : { lt: new Date(isoParaData(filtro.ate).getTime() + MS_POR_DIA) }),
    },
  };
}

export class SugestaoAportePrismaRepositorio implements AporteRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async listarCandidatos(usuarioId: string): Promise<readonly CandidatoAporte[]> {
    const [ativos, posicoes] = await Promise.all([
      this.prisma.ativo.findMany({
        where: { usuarioId },
        select: {
          id: true,
          ticker: true,
          nome: true,
          status: true,
          classeId: true,
          segmentoId: true,
          classe: { select: { codigo: true } },
          segmento: { select: { codigo: true } },
        },
        orderBy: { ticker: "asc" },
      }),
      this.prisma.posicaoAtivo.findMany({
        where: { usuarioId, quantidade: { gt: 0 } },
        select: { ativoId: true, custoTotal: true },
      }),
    ]);

    const posicaoPorAtivo = new Map(
      posicoes.map((posicao) => [posicao.ativoId, posicao.custoTotal.toFixed(2)]),
    );

    return ativos.map((ativo) => ({
      ativoId: ativo.id,
      ticker: ativo.ticker,
      nome: ativo.nome,
      status: ativo.status,
      classeId: ativo.classeId,
      classeCodigo: ativo.classe.codigo,
      segmentoId: ativo.segmentoId,
      segmentoCodigo: ativo.segmento?.codigo ?? null,
      naCarteira: posicaoPorAtivo.has(ativo.id),
      valorAtual: posicaoPorAtivo.get(ativo.id) ?? "0.00",
    }));
  }

  async criar(novo: NovaSugestaoAporte): Promise<SugestaoAporteRegistro> {
    const row = await this.prisma.sugestaoAporte.create({
      data: {
        usuarioId: novo.usuarioId,
        data: novo.data,
        valorDisponivel: novo.valorDisponivel,
        distribuicaoAtual: novo.distribuicaoAtual as unknown as Prisma.InputJsonValue,
        distribuicaoSugerida:
          novo.distribuicaoSugerida as unknown as Prisma.InputJsonValue,
        ativosAvaliados: novo.ativosAvaliados as unknown as Prisma.InputJsonValue,
        justificativas: novo.justificativas as unknown as Prisma.InputJsonValue,
        alertas: novo.alertas as unknown as Prisma.InputJsonValue,
      },
      select: SUGESTAO_SELECT,
    });

    return mapear(row);
  }

  async buscarPorId(
    usuarioId: string,
    sugestaoId: string,
  ): Promise<SugestaoAporteRegistro | null> {
    const row = await this.prisma.sugestaoAporte.findFirst({
      where: { id: sugestaoId, usuarioId },
      select: SUGESTAO_SELECT,
    });

    return row === null ? null : mapear(row);
  }

  async listarHistorico(
    filtro: FiltroHistoricoAportes,
  ): Promise<PaginaSugestoesAporte> {
    const where: Prisma.SugestaoAporteWhereInput = {
      usuarioId: filtro.usuarioId,
      ...(filtro.decisao === undefined ? {} : { decisaoUsuario: filtro.decisao }),
      ...filtroPeriodo(filtro),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sugestaoAporte.findMany({
        where,
        select: RESUMO_SELECT,
        // Ordem fixa do histórico (RN-052); `id` desempata e mantém a paginação
        // estável quando duas sugestões compartilham a mesma `data`.
        orderBy: [{ data: "desc" }, { id: "asc" }],
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.sugestaoAporte.count({ where }),
    ]);

    return { itens: rows.map(mapearResumo), total };
  }

  async atualizarDecisao(
    usuarioId: string,
    sugestaoId: string,
    decisao: DecisaoUsuario,
    decisaoEm: Date,
    observacoes: string | null,
  ): Promise<SugestaoAporteRegistro | null> {
    const alterado = await this.prisma.sugestaoAporte.updateMany({
      where: { id: sugestaoId, usuarioId },
      data: { decisaoUsuario: decisao, decisaoEm, observacoesDecisao: observacoes },
    });

    if (alterado.count === 0) {
      return null;
    }

    return this.buscarPorId(usuarioId, sugestaoId);
  }
}
