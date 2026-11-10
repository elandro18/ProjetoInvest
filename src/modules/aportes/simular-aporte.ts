import { hojeIsoSaoPaulo } from "../../lib/datas";
import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { obterMetas, type MetasVigentes } from "../alocacao/obter-metas";
import type { AlocacaoMetaRepositorio, MetaRegistro } from "../alocacao/repositorio";
import type { ValorCarteira } from "../carteira/valor-carteira";
import { calcularDistribuicao, type DistribuicaoMotor, type LinhaMetaAporte } from "./motor";

/**
 * Simulação stateless de aporte (RN-028; API_CONTRACTS.md §8.2; RN-028-1).
 *
 * Reaproveita o mesmo motor da sugestão (RN-025): a distribuição do valor
 * hipotético é calculada por water-filling sobre o patrimônio pós-aporte e
 * somada à carteira atual, produzindo o comparativo `antes`/`depois`/`delta`.
 *
 * Não existe dependência de escrita: o caso de uso só lê carteira e metas —
 * portanto nenhuma linha de `sugestao_aporte` é criada nem a carteira muda.
 * `delta.pontosPercentuais` é sempre `depois − antes` sobre os percentuais já
 * arredondados em 6 casas, para que a conta exiba exatamente o que a UI vê.
 */

const ESCALA_MONETARIA = 2;
const ESCALA_PERCENTUAL = 6;

export interface SimularAporteComando {
  readonly usuarioId: string;
  /** Valor hipotético como string decimal (`"1000.00"`). */
  readonly valorAporte: string;
}

export interface SimularAporteDeps {
  readonly valorCarteira: ValorCarteira;
  readonly metas: AlocacaoMetaRepositorio;
}

export interface LinhaSimulacao {
  readonly codigo: string;
  /** Valor com 2 casas. */
  readonly valor: string;
  /** Participação no patrimônio com 6 casas. */
  readonly percentual: string;
}

export interface ComparativoSimulacao {
  /** Patrimônio total com 2 casas. */
  readonly patrimonioTotal: string;
  readonly classe: readonly LinhaSimulacao[];
  readonly segmento: readonly LinhaSimulacao[];
}

export interface LinhaDelta {
  readonly codigo: string;
  /** `depois − antes`, em pontos percentuais, com 6 casas. */
  readonly pontosPercentuais: string;
}

export interface DeltaSimulacao {
  readonly classe: readonly LinhaDelta[];
  readonly segmento: readonly LinhaDelta[];
}

export interface SimulacaoAporte {
  readonly valorAporte: string;
  readonly antes: ComparativoSimulacao;
  readonly depois: ComparativoSimulacao;
  readonly delta: DeltaSimulacao;
}

interface ValoresPorReferencia {
  readonly classes: ReadonlyMap<string, Decimal>;
  readonly segmentos: ReadonlyMap<string, Decimal>;
}

interface ComparacaoEscopo {
  readonly metas: readonly MetaRegistro[];
  readonly atualPorReferencia: ReadonlyMap<string, Decimal>;
  readonly aportePorCodigo: ReadonlyMap<string, Decimal>;
  readonly totalAtual: Decimal;
  readonly totalPos: Decimal;
}

function indexarValores(
  valores: readonly { readonly id: string; readonly valor: string }[],
): Map<string, Decimal> {
  return new Map(valores.map((item) => [item.id, Decimal.from(item.valor)]));
}

function percentualSobre(valor: Decimal, total: Decimal): Decimal {
  return total.isZero()
    ? Decimal.zero(ESCALA_PERCENTUAL)
    : valor.mul("100").div(total, ESCALA_PERCENTUAL);
}

function linhaSimulacao(codigo: string, valor: Decimal, total: Decimal): LinhaSimulacao {
  return {
    codigo,
    valor: valor.toFixed(ESCALA_MONETARIA),
    percentual: percentualSobre(valor, total).toFixed(ESCALA_PERCENTUAL),
  };
}

function montarAntes(comparacao: ComparacaoEscopo): LinhaSimulacao[] {
  return comparacao.metas.map((meta) =>
    linhaSimulacao(
      meta.codigo,
      comparacao.atualPorReferencia.get(meta.referenciaId) ?? Decimal.zero(ESCALA_MONETARIA),
      comparacao.totalAtual,
    ),
  );
}

function montarDepois(comparacao: ComparacaoEscopo): LinhaSimulacao[] {
  return comparacao.metas.map((meta) => {
    const atual = comparacao.atualPorReferencia.get(meta.referenciaId) ?? Decimal.zero(ESCALA_MONETARIA);
    const aporte = comparacao.aportePorCodigo.get(meta.codigo) ?? Decimal.zero(ESCALA_MONETARIA);

    return linhaSimulacao(meta.codigo, atual.add(aporte), comparacao.totalPos);
  });
}

function montarDelta(antes: readonly LinhaSimulacao[], depois: readonly LinhaSimulacao[]): LinhaDelta[] {
  return antes.map((linha, indice) => ({
    codigo: linha.codigo,
    pontosPercentuais: Decimal.from(depois[indice].percentual)
      .sub(linha.percentual)
      .toFixed(ESCALA_PERCENTUAL),
  }));
}

function compararEscopo(comparacao: ComparacaoEscopo) {
  const antes = montarAntes(comparacao);
  const depois = montarDepois(comparacao);

  return { antes, depois, delta: montarDelta(antes, depois) };
}

/** Metas vigentes, criando os defaults lazy do titular quando necessário (RN-021). */
async function carregarMetasVigentes(
  usuarioId: string,
  repositorio: AlocacaoMetaRepositorio,
): Promise<Result<MetasVigentes, AppError>> {
  const referencias = await repositorio.listarReferencias();
  if (referencias.classes.length === 0 && referencias.segmentos.length === 0) {
    return err(errors.aporteDadosInsuficientes({ motivo: "catalogo_vazio" }));
  }

  const consulta = await obterMetas({ usuarioId, hoje: hojeIsoSaoPaulo() }, { repositorio });
  if (!consulta.ok) {
    return err(errors.aporteDadosInsuficientes({ motivo: consulta.error.code }));
  }

  const { vigente } = consulta.value;
  if (vigente.classe.length === 0) {
    return err(errors.aporteDadosInsuficientes({ motivo: "sem_classes" }));
  }

  return ok(vigente);
}

function montarLinhasMotor(
  metas: readonly MetaRegistro[],
  atualPorReferencia: ReadonlyMap<string, Decimal>,
): LinhaMetaAporte[] {
  return metas.map((meta) => ({
    codigo: meta.codigo,
    nome: meta.nome,
    valorAtual: (
      atualPorReferencia.get(meta.referenciaId) ?? Decimal.zero(ESCALA_MONETARIA)
    ).toFixed(ESCALA_MONETARIA),
    percentualMeta: meta.percentual,
  }));
}

function mapaDeAportes(linhas: readonly { readonly codigo: string; readonly valor: string }[]) {
  return new Map(linhas.map((linha) => [linha.codigo, Decimal.from(linha.valor)]));
}

function compararCarteira(
  vigente: MetasVigentes,
  carteira: ValoresPorReferencia & { readonly total: string },
  distribuicao: DistribuicaoMotor,
) {
  const totalAtual = Decimal.from(carteira.total);
  const totalPos = Decimal.from(distribuicao.totalPosAporte);
  const classe = compararEscopo({
    metas: vigente.classe,
    atualPorReferencia: carteira.classes,
    aportePorCodigo: mapaDeAportes(distribuicao.classes),
    totalAtual,
    totalPos,
  });
  const segmento = compararEscopo({
    metas: vigente.segmento,
    atualPorReferencia: carteira.segmentos,
    aportePorCodigo: mapaDeAportes(distribuicao.segmentos),
    totalAtual,
    totalPos,
  });

  return { totalAtual, totalPos, classe, segmento };
}

function montarSimulacao(
  valorAporte: Decimal,
  vigente: MetasVigentes,
  carteira: ValoresPorReferencia & { readonly total: string },
  distribuicao: DistribuicaoMotor,
): SimulacaoAporte {
  const comparacao = compararCarteira(vigente, carteira, distribuicao);

  return {
    valorAporte: valorAporte.toFixed(ESCALA_MONETARIA),
    antes: {
      patrimonioTotal: comparacao.totalAtual.toFixed(ESCALA_MONETARIA),
      classe: comparacao.classe.antes,
      segmento: comparacao.segmento.antes,
    },
    depois: {
      patrimonioTotal: comparacao.totalPos.toFixed(ESCALA_MONETARIA),
      classe: comparacao.classe.depois,
      segmento: comparacao.segmento.depois,
    },
    delta: {
      classe: comparacao.classe.delta,
      segmento: comparacao.segmento.delta,
    },
  };
}

export async function simularAporte(
  comando: SimularAporteComando,
  deps: SimularAporteDeps,
): Promise<Result<SimulacaoAporte, AppError>> {
  const valor = Decimal.parse(comando.valorAporte);
  if (!valor.ok || !valor.value.gt("0")) {
    return err(errors.aporteValorInvalido({ campo: "valorAporte" }));
  }
  const valorAporte = valor.value.round(ESCALA_MONETARIA);

  const metas = await carregarMetasVigentes(comando.usuarioId, deps.metas);
  if (!metas.ok) {
    return metas;
  }

  const valores = await deps.valorCarteira.agregar(comando.usuarioId);
  const valoresPorReferencia: ValoresPorReferencia = {
    classes: indexarValores(valores.classes),
    segmentos: indexarValores(valores.segmentos),
  };

  const distribuicao = calcularDistribuicao({
    totalAtual: valores.total,
    valorAporte: valorAporte.toFixed(ESCALA_MONETARIA),
    classes: montarLinhasMotor(metas.value.classe, valoresPorReferencia.classes),
    segmentos: montarLinhasMotor(metas.value.segmento, valoresPorReferencia.segmentos),
  });

  return ok(
    montarSimulacao(
      valorAporte,
      metas.value,
      { total: valores.total, ...valoresPorReferencia },
      distribuicao,
    ),
  );
}
