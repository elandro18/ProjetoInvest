import { hojeIsoSaoPaulo } from "../../lib/datas";
import {
  AppError,
  ERROR_CATALOG,
  errors,
  type AppErrorCode,
} from "../../lib/errors";
import { err, isErr, ok, type Result } from "../../lib/result";
import {
  calcularDesvios,
  type DesviosAlocacao,
  type ItemDesvio,
} from "../alocacao/calcular-desvios";
import type { AlocacaoMetaRepositorio } from "../alocacao/repositorio";
import {
  obterCarteira,
  type RegistrarInconsistenciaCarteira,
} from "../carteira/obter-carteira";
import { obterEvolucao } from "../carteira/obter-evolucao";
import type { CarteiraRepositorio } from "../carteira/repositorio";
import type { CarteiraConsolidada } from "../carteira/consolidar-carteira";
import type { EvolucaoCarteira } from "../carteira/evolucao-carteira";
import type { ValorCarteira } from "../carteira/valor-carteira";
import { montarIndicadores } from "./indicadores";
import { janelaMeses } from "./periodos";
import type { DashboardRepositorio } from "./repositorio";
import { montarGraficos, montarOportunidades } from "./series";
import type {
  DashboardResultado,
  ErroBlocoDashboard,
  GraficosDashboard,
  IndicadoresDashboard,
  NomeBlocoDashboard,
  OportunidadesDashboard,
} from "./tipos";

/**
 * Caso de uso do agregado do dashboard (RN-061, RN-062, RN-063, RN-073;
 * API_CONTRACTS.md §5.3).
 *
 * Cada bloco é montado de forma independente: a falha de uma fonte vira um
 * item em `erros[]` e não derruba os demais (RN-073). A resposta só é 503
 * quando nenhum bloco pôde ser produzido.
 *
 * As regras de patrimônio/percentual continuam nos módulos existentes — aqui
 * só há orquestração e a montagem dos indicadores/séries.
 */

export interface ObterDashboardComando {
  readonly usuarioId: string;
}

export interface ObterDashboardDeps {
  readonly carteira: {
    readonly repositorio: CarteiraRepositorio;
    readonly registrarInconsistencia?: RegistrarInconsistenciaCarteira;
  };
  readonly alocacao: {
    readonly repositorio: AlocacaoMetaRepositorio;
    readonly valorCarteira: ValorCarteira;
  };
  readonly dashboard: DashboardRepositorio;
  /** Injetável nos testes; default = agora. */
  readonly agora?: Date;
}

interface Captura<T> {
  readonly ok: true;
  readonly value: T;
}

type CapturaResultado<T> = Captura<T> | { readonly ok: false; readonly error: unknown };

async function capturar<T>(
  operacao: () => Promise<T>,
): Promise<CapturaResultado<T>> {
  try {
    return { ok: true, value: await operacao() };
  } catch (error) {
    return { ok: false, error };
  }
}

async function carregarCarteira(
  usuarioId: string,
  deps: ObterDashboardDeps,
  agora: Date,
): Promise<CarteiraConsolidada> {
  const resultado = await obterCarteira(
    { usuarioId },
    {
      repositorio: deps.carteira.repositorio,
      registrarInconsistencia: deps.carteira.registrarInconsistencia,
      agora,
    },
  );

  if (isErr(resultado)) {
    throw resultado.error;
  }

  return resultado.value;
}

async function carregarEvolucao(
  usuarioId: string,
  de: string,
  ate: string,
  deps: ObterDashboardDeps,
  agora: Date,
): Promise<EvolucaoCarteira> {
  const resultado = await obterEvolucao(
    { usuarioId, de, ate, granularidade: "mes" },
    { repositorio: deps.carteira.repositorio, agora },
  );

  if (isErr(resultado)) {
    throw resultado.error;
  }

  return resultado.value;
}

async function carregarDesvios(
  usuarioId: string,
  deps: ObterDashboardDeps,
): Promise<DesviosAlocacao> {
  const resultado = await calcularDesvios(
    { usuarioId },
    {
      repositorio: deps.alocacao.repositorio,
      valorCarteira: deps.alocacao.valorCarteira,
    },
  );

  if (isErr(resultado)) {
    throw resultado.error;
  }

  return resultado.value;
}

function ehMetasAusentes(error: unknown): boolean {
  return AppError.isAppError(error) && error.code === "ALO_METAS_AUSENTES";
}

function codigoDoErro(error: unknown): AppErrorCode {
  return AppError.isAppError(error) ? error.code : "ERRO_INTERNO";
}

function mensagemDoErro(error: unknown): string {
  return AppError.isAppError(error)
    ? error.message
    : ERROR_CATALOG.ERRO_INTERNO.message;
}

function erroDoBloco(
  bloco: NomeBlocoDashboard,
  error: unknown,
): ErroBlocoDashboard {
  return {
    bloco,
    code: codigoDoErro(error),
    message: mensagemDoErro(error),
  };
}

export async function obterDashboard(
  comando: ObterDashboardComando,
  deps: ObterDashboardDeps,
): Promise<Result<DashboardResultado, AppError>> {
  const agora = deps.agora ?? new Date();
  const hoje = hojeIsoSaoPaulo(agora);
  const janela = janelaMeses(hoje);

  // Cada fonte é capturada isoladamente: uma exceção não interrompe as demais.
  const [
    carteiraC,
    desviosC,
    valorAplicadoC,
    rendimentosTotaisC,
    rendimentosC,
    dividendosC,
    evolucaoC,
  ] = await Promise.all([
    capturar(() => carregarCarteira(comando.usuarioId, deps, agora)),
    capturar(() => carregarDesvios(comando.usuarioId, deps)),
    capturar(() => deps.dashboard.somarValorAplicadoRendaFixa(comando.usuarioId)),
    capturar(() => deps.dashboard.somarRendimentosTotais(comando.usuarioId)),
    capturar(() =>
      deps.dashboard.listarRendimentos(
        comando.usuarioId,
        janela.de,
        janela.ate,
      ),
    ),
    capturar(() => deps.dashboard.listarDividendos(comando.usuarioId, 12)),
    capturar(() =>
      carregarEvolucao(comando.usuarioId, janela.de, janela.ate, deps, agora),
    ),
  ]);

  const metasAusentes = !desviosC.ok && ehMetasAusentes(desviosC.error);
  /** Lista de desvios já calculados; `null` quando o titular não tem metas. */
  const desvios: readonly ItemDesvio[] | null = desviosC.ok
    ? desviosC.value.itens
    : null;
  /** Falha real de desvios (metas ausentes não contam como falha). */
  const desviosErro = desviosC.ok || metasAusentes ? null : desviosC.error;

  const erros: ErroBlocoDashboard[] = [];

  let indicadores: IndicadoresDashboard | undefined;
  let graficos: GraficosDashboard | undefined;
  let oportunidades: OportunidadesDashboard | undefined;

  if (!carteiraC.ok) {
    erros.push(erroDoBloco("indicadores", carteiraC.error));
  } else if (!valorAplicadoC.ok) {
    erros.push(erroDoBloco("indicadores", valorAplicadoC.error));
  } else if (!rendimentosTotaisC.ok) {
    erros.push(erroDoBloco("indicadores", rendimentosTotaisC.error));
  } else if (desviosErro !== null) {
    // Metas ausentes (`desvios === null`) não bloqueiam os indicadores: a
    // comparação simplesmente não aparece. Qualquer outra falha bloqueia.
    erros.push(erroDoBloco("indicadores", desviosErro));
  } else {
    indicadores = montarIndicadores({
      carteira: carteiraC.value,
      desvios,
      valorAplicadoRendaFixa: valorAplicadoC.value,
      rendimentosTotais: rendimentosTotaisC.value,
    });
  }

  if (!carteiraC.ok) {
    erros.push(erroDoBloco("graficos", carteiraC.error));
  } else if (!rendimentosC.ok) {
    erros.push(erroDoBloco("graficos", rendimentosC.error));
  } else if (!dividendosC.ok) {
    erros.push(erroDoBloco("graficos", dividendosC.error));
  } else if (!evolucaoC.ok) {
    erros.push(erroDoBloco("graficos", evolucaoC.error));
  } else {
    graficos = montarGraficos({
      carteira: carteiraC.value,
      evolucao: evolucaoC.value,
      rendimentos: rendimentosC.value,
      dividendos: dividendosC.value,
      meses: janela.meses,
    });
  }

  if (!desviosC.ok) {
    if (metasAusentes) {
      oportunidades = montarOportunidades([]);
    } else {
      erros.push(erroDoBloco("oportunidades", desviosC.error));
    }
  } else {
    oportunidades = montarOportunidades(desviosC.value.itens);
  }

  if (
    indicadores === undefined &&
    graficos === undefined &&
    oportunidades === undefined
  ) {
    return err(errors.bancoIndisponivel());
  }

  return ok({
    ...(indicadores === undefined ? {} : { indicadores }),
    ...(graficos === undefined ? {} : { graficos }),
    ...(oportunidades === undefined ? {} : { oportunidades }),
    erros,
  });
}
