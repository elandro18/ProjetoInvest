import { Prisma, type PrismaClient } from "@prisma/client";

import { dataParaIso, isoParaData } from "../../modules/renda-fixa/datas";
import {
  type CamposAtualizacaoRendaFixa,
  type FiltroRendaFixa,
  type InvestimentoRendaFixaRegistro,
  type NovoInvestimentoRendaFixa,
  type PaginaRendaFixa,
  type RendaFixaRepositorio,
} from "../../modules/renda-fixa/repositorio";

/**
 * Implementação Prisma do port `RendaFixaRepositorio` (RN-057, RN-059).
 *
 * Toda consulta é escopada por `usuario_id`; os CHECKs de taxa/valor/vencimento
 * e o trigger de `atualizado_em` vivem na migration `renda_fixa`. Valores saem
 * normalizados na escala do contrato (taxa 6 casas, dinheiro 2 casas).
 */

const INVESTIMENTO_SELECT = {
  id: true,
  instituicao: true,
  produto: true,
  indexador: true,
  taxa: true,
  dataAplicacao: true,
  vencimento: true,
  valorAplicado: true,
  saldoAtual: true,
  statusSaldo: true,
  liquidez: true,
  carenciaAte: true,
  coberturaFgc: true,
  observacoes: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.InvestimentoRendaFixaSelect;

type InvestimentoSelecionado = Prisma.InvestimentoRendaFixaGetPayload<{
  select: typeof INVESTIMENTO_SELECT;
}>;

function mapearInvestimento(row: InvestimentoSelecionado): InvestimentoRendaFixaRegistro {
  return {
    id: row.id,
    instituicao: row.instituicao,
    produto: row.produto,
    indexador: row.indexador,
    taxa: row.taxa.toFixed(6),
    dataAplicacao: dataParaIso(row.dataAplicacao),
    vencimento: row.vencimento === null ? null : dataParaIso(row.vencimento),
    valorAplicado: row.valorAplicado.toFixed(2),
    saldoAtual: row.saldoAtual.toFixed(2),
    statusSaldo: row.statusSaldo,
    liquidez: row.liquidez,
    carenciaAte: row.carenciaAte === null ? null : dataParaIso(row.carenciaAte),
    coberturaFgc: row.coberturaFgc,
    observacoes: row.observacoes,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function filtroWhere(filtro: FiltroRendaFixa): Prisma.InvestimentoRendaFixaWhereInput {
  const instituicao = filtro.instituicao?.trim();

  return {
    usuarioId: filtro.usuarioId,
    ...(filtro.produto !== undefined ? { produto: filtro.produto } : {}),
    ...(instituicao !== undefined && instituicao.length > 0
      ? { instituicao: { contains: instituicao, mode: "insensitive" } }
      : {}),
    ...(filtro.vencimentoAte !== undefined
      ? { vencimento: { lte: isoParaData(filtro.vencimentoAte) } }
      : {}),
  };
}

function ordemDe(filtro: FiltroRendaFixa): Prisma.InvestimentoRendaFixaOrderByWithRelationInput {
  const order = filtro.order;

  switch (filtro.sort) {
    // Nulos por último na lista: títulos sem vencimento não encabeçam a tela.
    case "vencimento":
      return { vencimento: { sort: order, nulls: "last" } };
    case "instituicao":
      return { instituicao: order };
    case "produto":
      return { produto: order };
    case "dataAplicacao":
      return { dataAplicacao: order };
    case "saldoAtual":
      return { saldoAtual: order };
    case "criadoEm":
    default:
      return { criadoEm: order };
  }
}

function dadosCriacao(novo: NovoInvestimentoRendaFixa): Prisma.InvestimentoRendaFixaCreateInput {
  return {
    usuario: { connect: { id: novo.usuarioId } },
    instituicao: novo.instituicao,
    produto: novo.produto,
    indexador: novo.indexador,
    taxa: novo.taxa,
    dataAplicacao: isoParaData(novo.dataAplicacao),
    vencimento: novo.vencimento === null ? null : isoParaData(novo.vencimento),
    valorAplicado: novo.valorAplicado,
    saldoAtual: novo.saldoAtual,
    statusSaldo: novo.statusSaldo,
    liquidez: novo.liquidez,
    carenciaAte: novo.carenciaAte === null ? null : isoParaData(novo.carenciaAte),
    coberturaFgc: novo.coberturaFgc,
    observacoes: novo.observacoes,
  };
}

function dadosAtualizacao(
  campos: CamposAtualizacaoRendaFixa,
): Prisma.InvestimentoRendaFixaUncheckedUpdateInput {
  return {
    ...(campos.saldoAtual !== undefined ? { saldoAtual: campos.saldoAtual } : {}),
    ...(campos.statusSaldo !== undefined ? { statusSaldo: campos.statusSaldo } : {}),
    ...(campos.liquidez !== undefined ? { liquidez: campos.liquidez } : {}),
    ...(campos.carenciaAte !== undefined
      ? { carenciaAte: campos.carenciaAte === null ? null : isoParaData(campos.carenciaAte) }
      : {}),
    ...(campos.coberturaFgc !== undefined ? { coberturaFgc: campos.coberturaFgc } : {}),
    ...(campos.observacoes !== undefined ? { observacoes: campos.observacoes } : {}),
    // Permite PATCH vazio e mantém a coluna consistente mesmo sem trigger.
    atualizadoEm: new Date(),
  };
}

export class RendaFixaPrismaRepositorio implements RendaFixaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async criar(novo: NovoInvestimentoRendaFixa): Promise<InvestimentoRendaFixaRegistro> {
    const row = await this.prisma.investimentoRendaFixa.create({
      data: dadosCriacao(novo),
      select: INVESTIMENTO_SELECT,
    });
    return mapearInvestimento(row);
  }

  async listar(filtro: FiltroRendaFixa): Promise<PaginaRendaFixa> {
    const where = filtroWhere(filtro);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.investimentoRendaFixa.findMany({
        where,
        select: INVESTIMENTO_SELECT,
        orderBy: ordemDe(filtro),
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.investimentoRendaFixa.count({ where }),
    ]);

    return { itens: rows.map(mapearInvestimento), total };
  }

  async buscarPorId(
    usuarioId: string,
    id: string,
  ): Promise<InvestimentoRendaFixaRegistro | null> {
    const row = await this.prisma.investimentoRendaFixa.findFirst({
      where: { id, usuarioId },
      select: INVESTIMENTO_SELECT,
    });
    return row === null ? null : mapearInvestimento(row);
  }

  async atualizar(
    usuarioId: string,
    id: string,
    campos: CamposAtualizacaoRendaFixa,
  ): Promise<InvestimentoRendaFixaRegistro | null> {
    const alterado = await this.prisma.investimentoRendaFixa.updateMany({
      where: { id, usuarioId },
      data: dadosAtualizacao(campos),
    });

    if (alterado.count === 0) {
      return null;
    }

    return this.buscarPorId(usuarioId, id);
  }

  async listarPorUsuario(
    usuarioId: string,
  ): Promise<readonly InvestimentoRendaFixaRegistro[]> {
    const rows = await this.prisma.investimentoRendaFixa.findMany({
      where: { usuarioId },
      select: INVESTIMENTO_SELECT,
      orderBy: { vencimento: { sort: "asc", nulls: "last" } },
    });

    return rows.map(mapearInvestimento);
  }
}
