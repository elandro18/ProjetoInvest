import { hojeIso } from "../../lib/datas";
import type { AppError } from "../../lib/errors";
import { ok, type Result } from "../../lib/result";
import { montarDefaults } from "./metas";
import type { AlocacaoMetaRepositorio, MetaRegistro } from "./repositorio";

/**
 * Leitura das metas vigentes (RN-021-2; API_CONTRACTS.md §7.1).
 *
 * Defaults lazy por titular (RN-021-1): como as metas são dado do usuário, não
 * existe seed global. No primeiro `GET` sem configuração vigente, o conjunto
 * inicial é materializado uma única vez em transação (`garantirVigencia`) e
 * devolvido na mesma resposta. Chamadas seguintes apenas leem.
 */

export interface MetasVigentes {
  readonly classe: readonly MetaRegistro[];
  readonly segmento: readonly MetaRegistro[];
  readonly vigenciaInicio: string;
}

export interface PeriodoMetas {
  readonly vigenciaInicio: string;
  readonly vigenciaFim: string;
  readonly classe: readonly MetaRegistro[];
  readonly segmento: readonly MetaRegistro[];
}

export interface ConsultaMetas {
  readonly vigente: MetasVigentes;
  readonly historico: readonly PeriodoMetas[];
}

export interface ObterMetasComando {
  readonly usuarioId: string;
  /** Injetável nos testes; default = hoje UTC. */
  readonly hoje?: string;
}

export interface MetasDeps {
  readonly repositorio: AlocacaoMetaRepositorio;
}

function ordenar(metas: readonly MetaRegistro[]): MetaRegistro[] {
  return [...metas].sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
}

export function montarVigente(metas: readonly MetaRegistro[]): MetasVigentes {
  const vigentes = metas.filter((meta) => meta.vigenciaFim === null);
  const vigenciaInicio = vigentes
    .map((meta) => meta.vigenciaInicio)
    .sort()
    .at(-1);

  return {
    classe: ordenar(vigentes.filter((meta) => meta.escopo === "CLASSE")),
    segmento: ordenar(vigentes.filter((meta) => meta.escopo === "SEGMENTO")),
    vigenciaInicio: vigenciaInicio ?? "",
  };
}

/** Agrupa as linhas encerradas por período (início/fim) — o histórico do contrato. */
export function agruparHistorico(metas: readonly MetaRegistro[]): PeriodoMetas[] {
  const periodos = new Map<string, { inicio: string; fim: string; metas: MetaRegistro[] }>();

  for (const meta of metas) {
    if (meta.vigenciaFim === null) {
      continue;
    }

    const chave = `${meta.vigenciaInicio}|${meta.vigenciaFim}`;
    const periodo = periodos.get(chave);
    if (periodo === undefined) {
      periodos.set(chave, {
        inicio: meta.vigenciaInicio,
        fim: meta.vigenciaFim,
        metas: [meta],
      });
    } else {
      periodo.metas.push(meta);
    }
  }

  return [...periodos.values()]
    .sort((a, b) => b.inicio.localeCompare(a.inicio) || b.fim.localeCompare(a.fim))
    .map((periodo) => ({
      vigenciaInicio: periodo.inicio,
      vigenciaFim: periodo.fim,
      classe: ordenar(periodo.metas.filter((meta) => meta.escopo === "CLASSE")),
      segmento: ordenar(periodo.metas.filter((meta) => meta.escopo === "SEGMENTO")),
    }));
}

export function montarConsulta(metas: readonly MetaRegistro[]): ConsultaMetas {
  return {
    vigente: montarVigente(metas),
    historico: agruparHistorico(metas),
  };
}

export async function obterMetas(
  comando: ObterMetasComando,
  deps: MetasDeps,
): Promise<Result<ConsultaMetas, AppError>> {
  const hoje = comando.hoje ?? hojeIso();
  let todas = await deps.repositorio.listarTodas(comando.usuarioId);

  if (todas.every((meta) => meta.vigenciaFim !== null)) {
    const referencias = await deps.repositorio.listarReferencias();
    const defaults = montarDefaults(referencias);
    if (!defaults.ok) {
      return defaults;
    }

    await deps.repositorio.garantirVigencia(comando.usuarioId, defaults.value, hoje);
    todas = await deps.repositorio.listarTodas(comando.usuarioId);
  }

  return ok(montarConsulta(todas));
}
