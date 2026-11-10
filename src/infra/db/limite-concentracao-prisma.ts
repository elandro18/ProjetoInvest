import { Prisma, type PrismaClient } from "@prisma/client";

import { dataParaIso, isoParaData } from "../../lib/datas";
import type {
  LimiteConcentracaoRepositorio,
  LimiteRegistro,
  NovoLimite,
} from "../../modules/risco/repositorio";

/**
 * Implementação Prisma do port `LimiteConcentracaoRepositorio` (RN-049, RN-082;
 * DATA_MODEL.md §4.18).
 *
 * A substituição roda em transação interativa: encerra a vigência corrente e
 * insere o novo conjunto juntos. O CHECK de percentual/vigência e o índice
 * único parcial `ux_limite_vigente` vivem na migration
 * `limites_concentracao` (Prisma não os expressa).
 */

const LIMITE_SELECT = {
  id: true,
  dimensao: true,
  referencia: true,
  percentualMax: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  criadoEm: true,
} satisfies Prisma.LimiteConcentracaoSelect;

type LimiteSelecionado = Prisma.LimiteConcentracaoGetPayload<{
  select: typeof LIMITE_SELECT;
}>;

function mapear(row: LimiteSelecionado): LimiteRegistro {
  return {
    id: row.id,
    dimensao: row.dimensao,
    referencia: row.referencia,
    percentualMax: row.percentualMax.toFixed(6),
    vigenciaInicio: dataParaIso(row.vigenciaInicio),
    vigenciaFim: row.vigenciaFim === null ? null : dataParaIso(row.vigenciaFim),
    criadoEm: row.criadoEm,
  };
}

function dadosNovoLimite(
  usuarioId: string,
  limite: NovoLimite,
  vigenciaInicio: Date,
): Prisma.LimiteConcentracaoCreateManyInput {
  return {
    usuarioId,
    dimensao: limite.dimensao,
    referencia: limite.referencia,
    percentualMax: limite.percentualMax,
    vigenciaInicio,
  };
}

export class LimiteConcentracaoPrismaRepositorio
  implements LimiteConcentracaoRepositorio
{
  constructor(private readonly prisma: PrismaClient) {}

  async listarVigentes(usuarioId: string): Promise<readonly LimiteRegistro[]> {
    const rows = await this.prisma.limiteConcentracao.findMany({
      where: { usuarioId, vigenciaFim: null },
      select: LIMITE_SELECT,
      orderBy: [{ dimensao: "asc" }, { referencia: "asc" }],
    });

    return rows.map(mapear);
  }

  async listarTodas(usuarioId: string): Promise<readonly LimiteRegistro[]> {
    const rows = await this.prisma.limiteConcentracao.findMany({
      where: { usuarioId },
      select: LIMITE_SELECT,
      orderBy: [{ vigenciaInicio: "desc" }, { criadoEm: "asc" }],
    });

    return rows.map(mapear);
  }

  async substituirVigencia(
    usuarioId: string,
    limites: readonly NovoLimite[],
    vigenciaInicio: string,
  ): Promise<void> {
    const inicio = isoParaData(vigenciaInicio);

    await this.prisma.$transaction(async (tx) => {
      // Encerra a vigência corrente no mesmo dia do novo conjunto. A leitura
      // depende apenas de `vigencia_fim IS NULL`, então a troca é atômica:
      // nunca há duas vigências abertas para a mesma referência.
      await tx.limiteConcentracao.updateMany({
        where: { usuarioId, vigenciaFim: null },
        data: { vigenciaFim: inicio },
      });

      if (limites.length > 0) {
        await tx.limiteConcentracao.createMany({
          data: limites.map((limite) => dadosNovoLimite(usuarioId, limite, inicio)),
        });
      }
    });
  }
}
