import { Prisma, type PrismaClient } from "@prisma/client";

import {
  AtivoTickerDuplicadoError,
  type AtivoRegistro,
  type AtivoRepositorio,
  type CamposAtualizacao,
  type ClasseAtivoRef,
  type FiltroAtivos,
  type NovoAtivo,
  type PaginaAtivos,
  type SegmentoAtivoRef,
} from "../../modules/ativos/repositorio";

/**
 * Implementação Prisma do port `AtivoRepositorio` (RN-010).
 *
 * Toda consulta é escopada por `usuario_id`; a unicidade do ticker é a do
 * índice `ux_ativo_usuario_ticker` (P2002). O CHECK de formato do ticker e o
 * trigger de `atualizado_em` vivem na migration.
 */

const ATIVO_SELECT = {
  id: true,
  ticker: true,
  nome: true,
  cnpj: true,
  administrador: true,
  gestor: true,
  status: true,
  fonteDados: true,
  observacoes: true,
  criadoEm: true,
  atualizadoEm: true,
  classe: { select: { id: true, codigo: true, nome: true } },
  segmento: { select: { id: true, codigo: true, nome: true } },
} satisfies Prisma.AtivoSelect;

type AtivoSelecionado = Prisma.AtivoGetPayload<{ select: typeof ATIVO_SELECT }>;

function mapearAtivo(row: AtivoSelecionado): AtivoRegistro {
  return {
    id: row.id,
    ticker: row.ticker,
    nome: row.nome,
    classe: row.classe,
    segmento: row.segmento,
    cnpj: row.cnpj,
    administrador: row.administrador,
    gestor: row.gestor,
    status: row.status,
    fonteDados: row.fonteDados,
    observacoes: row.observacoes,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

function filtroWhere(filtro: FiltroAtivos): Prisma.AtivoWhereInput {
  const q = filtro.q?.trim();

  return {
    usuarioId: filtro.usuarioId,
    ...(filtro.classeId !== undefined ? { classeId: filtro.classeId } : {}),
    ...(filtro.segmentoId !== undefined ? { segmentoId: filtro.segmentoId } : {}),
    ...(filtro.status !== undefined ? { status: filtro.status } : {}),
    ...(q !== undefined && q.length > 0
      ? {
          OR: [
            { ticker: { contains: q, mode: "insensitive" } },
            { nome: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function dadosAtualizacao(campos: CamposAtualizacao): Prisma.AtivoUncheckedUpdateInput {
  return {
    ...(campos.nome !== undefined ? { nome: campos.nome } : {}),
    ...(campos.segmentoId !== undefined ? { segmentoId: campos.segmentoId } : {}),
    ...(campos.cnpj !== undefined ? { cnpj: campos.cnpj } : {}),
    ...(campos.administrador !== undefined ? { administrador: campos.administrador } : {}),
    ...(campos.gestor !== undefined ? { gestor: campos.gestor } : {}),
    ...(campos.status !== undefined ? { status: campos.status } : {}),
    ...(campos.fonteDados !== undefined ? { fonteDados: campos.fonteDados } : {}),
    ...(campos.observacoes !== undefined ? { observacoes: campos.observacoes } : {}),
    // Permite PATCH vazio e mantém a coluna consistente mesmo sem trigger.
    atualizadoEm: new Date(),
  };
}

export class AtivoPrismaRepositorio implements AtivoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarClasse(classeId: string): Promise<ClasseAtivoRef | null> {
    return this.prisma.classeAtivo.findUnique({
      where: { id: classeId },
      select: { id: true, codigo: true, nome: true, ativo: true },
    });
  }

  async buscarSegmento(segmentoId: string): Promise<SegmentoAtivoRef | null> {
    return this.prisma.segmentoAtivo.findUnique({
      where: { id: segmentoId },
      select: { id: true, classeId: true, codigo: true, nome: true, ativo: true },
    });
  }

  async existeTicker(usuarioId: string, ticker: string, ignorarId?: string): Promise<boolean> {
    const encontrado = await this.prisma.ativo.findFirst({
      where: {
        usuarioId,
        ticker,
        ...(ignorarId !== undefined ? { id: { not: ignorarId } } : {}),
      },
      select: { id: true },
    });
    return encontrado !== null;
  }

  async criar(novo: NovoAtivo): Promise<AtivoRegistro> {
    try {
      const row = await this.prisma.ativo.create({
        data: {
          usuarioId: novo.usuarioId,
          ticker: novo.ticker,
          nome: novo.nome,
          classeId: novo.classeId,
          segmentoId: novo.segmentoId,
          cnpj: novo.cnpj,
          administrador: novo.administrador,
          gestor: novo.gestor,
          status: novo.status,
          fonteDados: novo.fonteDados,
          observacoes: novo.observacoes,
        },
        select: ATIVO_SELECT,
      });
      return mapearAtivo(row);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new AtivoTickerDuplicadoError();
      }
      throw erro;
    }
  }

  async listar(filtro: FiltroAtivos): Promise<PaginaAtivos> {
    const where = filtroWhere(filtro);
    const orderBy: Prisma.AtivoOrderByWithRelationInput = { [filtro.sort]: filtro.order };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ativo.findMany({
        where,
        select: ATIVO_SELECT,
        orderBy,
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.ativo.count({ where }),
    ]);

    return { itens: rows.map(mapearAtivo), total };
  }

  async buscarPorId(usuarioId: string, ativoId: string): Promise<AtivoRegistro | null> {
    const row = await this.prisma.ativo.findFirst({
      where: { id: ativoId, usuarioId },
      select: ATIVO_SELECT,
    });
    return row === null ? null : mapearAtivo(row);
  }

  async atualizar(
    usuarioId: string,
    ativoId: string,
    campos: CamposAtualizacao,
  ): Promise<AtivoRegistro | null> {
    const alterado = await this.prisma.ativo.updateMany({
      where: { id: ativoId, usuarioId },
      data: dadosAtualizacao(campos),
    });

    if (alterado.count === 0) {
      return null;
    }

    return this.buscarPorId(usuarioId, ativoId);
  }
}
