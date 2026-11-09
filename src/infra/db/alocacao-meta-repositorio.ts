import { Prisma, type PrismaClient } from "@prisma/client";

import { dataParaIso, isoParaData } from "../../lib/datas";
import type {
  AlocacaoMetaRepositorio,
  MetaRegistro,
  NovaMeta,
  ReferenciasAlocacao,
} from "../../modules/alocacao/repositorio";

/**
 * Implementação Prisma do port `AlocacaoMetaRepositorio` (RN-021, RN-022).
 *
 * A substituição roda em transação interativa: encerra a vigência corrente e
 * insere o novo conjunto juntos. Os CHECKs de referência/percentual/vigência e
 * o índice único parcial de uma linha vigente por referência vivem na migration
 * `alocacao_meta` (Prisma não os expressa).
 */

const META_SELECT = {
  id: true,
  escopo: true,
  classeId: true,
  segmentoId: true,
  percentual: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  criadoEm: true,
  classe: { select: { codigo: true, nome: true, ordem: true } },
  segmento: { select: { codigo: true, nome: true, ordem: true } },
} satisfies Prisma.AlocacaoMetaSelect;

type MetaSelecionada = Prisma.AlocacaoMetaGetPayload<{ select: typeof META_SELECT }>;

function mapear(row: MetaSelecionada): MetaRegistro {
  if (row.escopo === "CLASSE" && row.classeId !== null && row.classe !== null) {
    return {
      id: row.id,
      escopo: row.escopo,
      referenciaId: row.classeId,
      codigo: row.classe.codigo,
      nome: row.classe.nome,
      ordem: row.classe.ordem,
      percentual: row.percentual.toFixed(6),
      vigenciaInicio: dataParaIso(row.vigenciaInicio),
      vigenciaFim: row.vigenciaFim === null ? null : dataParaIso(row.vigenciaFim),
      criadoEm: row.criadoEm,
    };
  }

  if (row.escopo === "SEGMENTO" && row.segmentoId !== null && row.segmento !== null) {
    return {
      id: row.id,
      escopo: row.escopo,
      referenciaId: row.segmentoId,
      codigo: row.segmento.codigo,
      nome: row.segmento.nome,
      ordem: row.segmento.ordem,
      percentual: row.percentual.toFixed(6),
      vigenciaInicio: dataParaIso(row.vigenciaInicio),
      vigenciaFim: row.vigenciaFim === null ? null : dataParaIso(row.vigenciaFim),
      criadoEm: row.criadoEm,
    };
  }

  throw new Error(`alocacao_meta ${row.id} com referência incoerente com o escopo.`);
}

function dadosNovaMeta(
  usuarioId: string,
  meta: NovaMeta,
  vigenciaInicio: Date,
): Prisma.AlocacaoMetaCreateManyInput {
  return {
    usuarioId,
    escopo: meta.escopo,
    classeId: meta.escopo === "CLASSE" ? meta.referenciaId : null,
    segmentoId: meta.escopo === "SEGMENTO" ? meta.referenciaId : null,
    percentual: meta.percentual,
    vigenciaInicio,
  };
}

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

export class AlocacaoMetaPrismaRepositorio implements AlocacaoMetaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async listarVigentes(usuarioId: string): Promise<readonly MetaRegistro[]> {
    const rows = await this.prisma.alocacaoMeta.findMany({
      where: { usuarioId, vigenciaFim: null },
      select: META_SELECT,
      orderBy: [{ escopo: "asc" }, { vigenciaInicio: "desc" }],
    });

    return rows.map(mapear);
  }

  async listarTodas(usuarioId: string): Promise<readonly MetaRegistro[]> {
    const rows = await this.prisma.alocacaoMeta.findMany({
      where: { usuarioId },
      select: META_SELECT,
      orderBy: [{ vigenciaInicio: "desc" }, { criadoEm: "asc" }],
    });

    return rows.map(mapear);
  }

  async listarReferencias(): Promise<ReferenciasAlocacao> {
    const [classes, segmentos] = await Promise.all([
      this.prisma.classeAtivo.findMany({
        select: { id: true, codigo: true, nome: true, ordem: true, ativo: true },
        orderBy: { ordem: "asc" },
      }),
      this.prisma.segmentoAtivo.findMany({
        select: {
          id: true,
          codigo: true,
          nome: true,
          classeId: true,
          ordem: true,
          ativo: true,
        },
        orderBy: { ordem: "asc" },
      }),
    ]);

    return { classes, segmentos };
  }

  async garantirVigencia(
    usuarioId: string,
    metas: readonly NovaMeta[],
    vigenciaInicio: string,
  ): Promise<void> {
    const inicio = isoParaData(vigenciaInicio);

    try {
      await this.prisma.$transaction(async (tx) => {
        const vigente = await tx.alocacaoMeta.findFirst({
          where: { usuarioId, vigenciaFim: null },
          select: { id: true },
        });

        if (vigente !== null) {
          return;
        }

        await tx.alocacaoMeta.createMany({
          data: metas.map((meta) => dadosNovaMeta(usuarioId, meta, inicio)),
        });
      });
    } catch (erro) {
      // Corrida entre duas primeiras leituras: o índice parcial de vigência
      // garantiu que só um conjunto nasceu; a releitura do caso de uso resolve.
      if (!ehViolacaoDeUnicidade(erro)) {
        throw erro;
      }
    }
  }

  async substituirVigencia(
    usuarioId: string,
    metas: readonly NovaMeta[],
    vigenciaInicio: string,
  ): Promise<void> {
    const inicio = isoParaData(vigenciaInicio);

    await this.prisma.$transaction(async (tx) => {
      // Encerra a vigência corrente no mesmo dia do novo conjunto. A leitura
      // de metas depende apenas de `vigencia_fim IS NULL`, então a troca é
      // atômica: nunca há duas vigências abertas.
      await tx.alocacaoMeta.updateMany({
        where: { usuarioId, vigenciaFim: null },
        data: { vigenciaFim: inicio },
      });

      await tx.alocacaoMeta.createMany({
        data: metas.map((meta) => dadosNovaMeta(usuarioId, meta, inicio)),
      });
    });
  }
}
