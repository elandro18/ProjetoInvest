import { Decimal } from "../../lib/decimal";
import type {
  PosicaoCarteira,
  ReferenciaCarteira,
  RendimentoCarteira,
} from "./repositorio";

/**
 * Consolidação da carteira (RN-020, RN-023, RN-089, RN-091).
 *
 * Função pura: recebe as posições (quantidade > 0), o saldo de renda fixa e os
 * rendimentos do ano, e devolve o resumo, a distribuição por classe/segmento
 * e o diagnóstico de consistência. Nenhum acesso a banco ou framework.
 *
 * Regras:
 * - patrimônio total = soma do custo das posições + saldo da renda fixa
 *   (RN-089);
 * - FII entra pelo custo e é marcado `valorIndisponivel` — sem cotação, nunca
 *   zero (RN-091); renda fixa entra pelo saldo informado;
 * - todo percentual (classe, segmento e resumo) usa o patrimônio total como
 *   denominador (RN-089), inclusive "Caixa e Oportunidades";
 * - carteira vazia não divide por zero: percentuais e totais ficam `0.00`;
 * - rendimentos do mês/ano são recortados por `data_pagamento` no calendário
 *   de São Paulo, cuja data de referência chega já resolvida;
 * - a soma das classes deve fechar com o total ao centavo (tolerância de
 *   R$ 0,01). Divergência (ex.: posição apontando para classe inexistente) não
 *   interrompe a resposta: vira `consistente: false` + log no caso de uso.
 */

export const STATUS_DADO_INDISPONIVEL = "INDISPONIVEL" as const;
export const STATUS_DADO_MERCADO = "MERCADO" as const;

export type StatusDadoCarteira =
  | typeof STATUS_DADO_INDISPONIVEL
  | typeof STATUS_DADO_MERCADO;

export const CODIGO_RENDA_FIXA = "RENDA_FIXA";
export const CODIGO_FII = "FII";

const TOLERANCIA_CONSISTENCIA = "0.01";
const ESCALA_PERCENTUAL = 6;
const CEM = "100";

export interface CotacoesCarteira {
  readonly statusDado: StatusDadoCarteira;
  readonly dataReferencia: string | null;
}

export interface ResumoCarteira {
  /** Patrimônio total com 2 casas. */
  readonly patrimonioTotal: string;
  readonly rendaFixa: string;
  readonly fiis: string;
  /** Percentual sobre o total, com 6 casas. */
  readonly percentualRendaFixa: string;
  readonly percentualFiis: string;
  readonly quantidadeAtivos: number;
  readonly rendimentosMes: string;
  readonly rendimentosAcumuladosAno: string;
}

export interface ItemDistribuicaoCarteira {
  readonly codigo: string;
  readonly nome: string;
  readonly valor: string;
  /** Percentual sobre o patrimônio total, com 6 casas (RN-089). */
  readonly percentual: string;
  /** `true` quando o valor é custo/saldo, sem cotação de mercado (RN-091). */
  readonly valorIndisponivel: boolean;
}

/** Diagnóstico interno da consistência — não faz parte do contrato público. */
export interface DiagnosticoConsistencia {
  readonly somaClasses: string;
  readonly divergencia: string;
  readonly tolerancia: string;
}

export interface CarteiraConsolidada {
  readonly resumo: ResumoCarteira;
  readonly porClasse: readonly ItemDistribuicaoCarteira[];
  readonly porSegmento: readonly ItemDistribuicaoCarteira[];
  readonly consistente: boolean;
  readonly diagnostico: DiagnosticoConsistencia;
  /** Instante da consulta em ISO-8601 UTC. */
  readonly atualizadoEm: string;
  readonly cotacoes: CotacoesCarteira;
}

export interface DadosConsolidacaoCarteira {
  readonly posicoes: readonly PosicaoCarteira[];
  readonly rendaFixa: {
    readonly saldoTotal: string;
    readonly quantidadeTitulos: number;
  };
  readonly rendimentos: readonly RendimentoCarteira[];
  readonly classes: readonly ReferenciaCarteira[];
  readonly segmentos: readonly ReferenciaCarteira[];
  /** Data de referência do recorte mensal/anual (`YYYY-MM-DD`, São Paulo). */
  readonly dataReferencia: string;
  readonly atualizadoEm: string;
  /** Sem cotação na Fase 1: `INDISPONIVEL` e `dataReferencia: null`. */
  readonly cotacoes?: CotacoesCarteira;
}

export interface RecorteRendimentos {
  readonly mes: string;
  readonly ano: string;
}

/** Soma os rendimentos do mês e do ano da data de referência. */
export function recortarRendimentos(
  rendimentos: readonly RendimentoCarteira[],
  dataReferencia: string,
): RecorteRendimentos {
  const ano = dataReferencia.slice(0, 4);
  const mes = dataReferencia.slice(0, 7);

  let totalMes = Decimal.zero(2);
  let totalAno = Decimal.zero(2);

  for (const rendimento of rendimentos) {
    const valor = Decimal.from(rendimento.valor);
    if (rendimento.dataPagamento.startsWith(`${ano}-`)) {
      totalAno = totalAno.add(valor);
    }
    if (rendimento.dataPagamento.startsWith(mes)) {
      totalMes = totalMes.add(valor);
    }
  }

  return { mes: totalMes.toFixed(2), ano: totalAno.toFixed(2) };
}

function percentualSobreTotal(valor: Decimal, total: Decimal): Decimal {
  // `isPositive()` do decimal.js também é verdadeiro para +0; o denominador
  // só é utilizável quando o total é estritamente maior que zero.
  if (!total.gt("0")) {
    return Decimal.zero(ESCALA_PERCENTUAL);
  }

  return valor.mul(CEM).div(total, ESCALA_PERCENTUAL);
}

interface ItemBruto {
  readonly referencia: ReferenciaCarteira;
  readonly valor: Decimal;
  readonly valorIndisponivel: boolean;
}

function ordenarReferencias(itens: readonly ItemBruto[]): ItemBruto[] {
  return [...itens].sort(
    (a, b) =>
      a.referencia.ordem - b.referencia.ordem ||
      a.referencia.codigo.localeCompare(b.referencia.codigo),
  );
}

/**
 * Distribuição por classe ajusta o resíduo de arredondamento no último item
 * com valor para que a soma dos percentuais seja exatamente 100 quando o
 * total fecha com as classes (RN-023 e critério de aceitação da RN-020).
 */
function distribuirClasses(
  itens: readonly ItemBruto[],
  total: Decimal,
): readonly ItemDistribuicaoCarteira[] {
  const ordenados = ordenarReferencias(itens);
  if (ordenados.length === 0) {
    return [];
  }

  const percentuais = ordenados.map((item) => percentualSobreTotal(item.valor, total));

  // Só ajusta o resíduo quando as classes realmente fecham com o total. Se há
  // valor fora do catálogo (inconsistência), forçar 100% esconderia o problema.
  const somaValores = ordenados.reduce(
    (acumulado, item) => acumulado.add(item.valor),
    Decimal.zero(2),
  );

  if (total.gt("0") && somaValores.eq(total)) {
    const soma = percentuais.reduce(
      (acumulado, percentual) => acumulado.add(percentual),
      Decimal.zero(ESCALA_PERCENTUAL),
    );
    const residuo = Decimal.from(CEM).sub(soma);

    if (!residuo.isZero()) {
      let indice = -1;
      for (let i = ordenados.length - 1; i >= 0; i -= 1) {
        if (ordenados[i].valor.gt("0")) {
          indice = i;
          break;
        }
      }
      const alvo = indice >= 0 ? indice : ordenados.length - 1;
      percentuais[alvo] = percentuais[alvo].add(residuo);
    }
  }

  return ordenados.map((item, indice) => ({
    codigo: item.referencia.codigo,
    nome: item.referencia.nome,
    valor: item.valor.toFixed(2),
    percentual: percentuais[indice].toFixed(ESCALA_PERCENTUAL),
    valorIndisponivel: item.valorIndisponivel,
  }));
}

/**
 * Segmentos não somam 100 (a renda fixa não tem segmento); cada percentual é
 * calculado individualmente sobre o patrimônio total, como exige a RN-089.
 */
function distribuirSegmentos(
  itens: readonly ItemBruto[],
  total: Decimal,
): readonly ItemDistribuicaoCarteira[] {
  return ordenarReferencias(itens).map((item) => ({
    codigo: item.referencia.codigo,
    nome: item.referencia.nome,
    valor: item.valor.toFixed(2),
    percentual: percentualSobreTotal(item.valor, total).toFixed(ESCALA_PERCENTUAL),
    valorIndisponivel: item.valorIndisponivel,
  }));
}

interface AgregacaoPosicoes {
  somaPosicoes: Decimal;
  somaFiis: Decimal;
  quantidadeAtivos: number;
  readonly acumuladoClasse: Map<string, Decimal>;
  readonly acumuladoSegmento: Map<string, Decimal>;
}

function somarNoMapa(mapa: Map<string, Decimal>, chave: string, valor: Decimal): void {
  mapa.set(chave, (mapa.get(chave) ?? Decimal.zero(2)).add(valor));
}

function acumularPosicao(
  posicao: PosicaoCarteira,
  classesPorId: ReadonlyMap<string, ReferenciaCarteira>,
  segmentosPorId: ReadonlyMap<string, ReferenciaCarteira>,
  agregacao: AgregacaoPosicoes,
): void {
  const quantidade = Decimal.from(posicao.quantidade);
  if (!quantidade.gt("0")) {
    return;
  }

  const custo = Decimal.from(posicao.custoTotal);
  agregacao.quantidadeAtivos += 1;
  agregacao.somaPosicoes = agregacao.somaPosicoes.add(custo);

  const classe = classesPorId.get(posicao.classeId);
  if (classe !== undefined) {
    somarNoMapa(agregacao.acumuladoClasse, classe.id, custo);
    if (classe.codigo === CODIGO_FII) {
      agregacao.somaFiis = agregacao.somaFiis.add(custo);
    }
  }

  if (posicao.segmentoId !== null && segmentosPorId.has(posicao.segmentoId)) {
    somarNoMapa(agregacao.acumuladoSegmento, posicao.segmentoId, custo);
  }
}

function acumularPosicoes(
  posicoes: readonly PosicaoCarteira[],
  classesPorId: ReadonlyMap<string, ReferenciaCarteira>,
  segmentosPorId: ReadonlyMap<string, ReferenciaCarteira>,
): AgregacaoPosicoes {
  const agregacao: AgregacaoPosicoes = {
    somaPosicoes: Decimal.zero(2),
    somaFiis: Decimal.zero(2),
    quantidadeAtivos: 0,
    acumuladoClasse: new Map<string, Decimal>(),
    acumuladoSegmento: new Map<string, Decimal>(),
  };

  for (const posicao of posicoes) {
    acumularPosicao(posicao, classesPorId, segmentosPorId, agregacao);
  }

  return agregacao;
}

function acumularRendaFixa(
  classes: readonly ReferenciaCarteira[],
  acumuladoClasse: Map<string, Decimal>,
  rendaFixa: Decimal,
): void {
  const classeRendaFixa = classes.find((classe) => classe.codigo === CODIGO_RENDA_FIXA);
  if (classeRendaFixa !== undefined) {
    somarNoMapa(acumuladoClasse, classeRendaFixa.id, rendaFixa);
  }
}

function montarItensClasse(
  classes: readonly ReferenciaCarteira[],
  acumulado: ReadonlyMap<string, Decimal>,
): readonly ItemBruto[] {
  return classes
    .map((classe) => ({
      referencia: classe,
      valor: acumulado.get(classe.id) ?? Decimal.zero(2),
      // Somente a renda fixa tem valor informado; as demais classes são
      // posições de mercado sem cotação nesta fase (RN-091).
      valorIndisponivel: classe.codigo !== CODIGO_RENDA_FIXA,
    }))
    .filter((item) => !item.valor.isZero());
}

function montarItensSegmento(
  segmentos: readonly ReferenciaCarteira[],
  acumulado: ReadonlyMap<string, Decimal>,
): readonly ItemBruto[] {
  return segmentos
    .filter((segmento) => acumulado.has(segmento.id))
    .map((segmento) => ({
      referencia: segmento,
      valor: acumulado.get(segmento.id) ?? Decimal.zero(2),
      valorIndisponivel: true,
    }))
    .filter((item) => !item.valor.isZero());
}

interface Consistencia {
  readonly somaClasses: Decimal;
  readonly divergencia: Decimal;
  readonly consistente: boolean;
}

function calcularConsistencia(
  patrimonioTotal: Decimal,
  itensClasse: readonly ItemBruto[],
): Consistencia {
  const somaClasses = itensClasse.reduce(
    (acumulado, item) => acumulado.add(item.valor),
    Decimal.zero(2),
  );
  const divergencia = patrimonioTotal.sub(somaClasses).abs();

  return {
    somaClasses,
    divergencia,
    consistente: divergencia.lte(TOLERANCIA_CONSISTENCIA),
  };
}

interface ResumoParams {
  readonly patrimonioTotal: Decimal;
  readonly rendaFixa: Decimal;
  readonly fiis: Decimal;
  readonly quantidadeAtivos: number;
  readonly rendimentos: RecorteRendimentos;
}

function montarResumo(params: ResumoParams): ResumoCarteira {
  return {
    patrimonioTotal: params.patrimonioTotal.toFixed(2),
    rendaFixa: params.rendaFixa.toFixed(2),
    fiis: params.fiis.toFixed(2),
    percentualRendaFixa: percentualSobreTotal(
      params.rendaFixa,
      params.patrimonioTotal,
    ).toFixed(ESCALA_PERCENTUAL),
    percentualFiis: percentualSobreTotal(params.fiis, params.patrimonioTotal).toFixed(
      ESCALA_PERCENTUAL,
    ),
    quantidadeAtivos: params.quantidadeAtivos,
    rendimentosMes: params.rendimentos.mes,
    rendimentosAcumuladosAno: params.rendimentos.ano,
  };
}

export function consolidarCarteira(dados: DadosConsolidacaoCarteira): CarteiraConsolidada {
  const classesPorId = new Map(dados.classes.map((classe) => [classe.id, classe]));
  const segmentosPorId = new Map(dados.segmentos.map((segmento) => [segmento.id, segmento]));

  const agregacao = acumularPosicoes(dados.posicoes, classesPorId, segmentosPorId);
  const rendaFixa = Decimal.from(dados.rendaFixa.saldoTotal);
  acumularRendaFixa(dados.classes, agregacao.acumuladoClasse, rendaFixa);

  const patrimonioTotal = agregacao.somaPosicoes.add(rendaFixa);
  const itensClasse = montarItensClasse(dados.classes, agregacao.acumuladoClasse);
  const itensSegmento = montarItensSegmento(dados.segmentos, agregacao.acumuladoSegmento);
  const consistencia = calcularConsistencia(patrimonioTotal, itensClasse);
  const rendimentos = recortarRendimentos(dados.rendimentos, dados.dataReferencia);

  return {
    resumo: montarResumo({
      patrimonioTotal,
      rendaFixa,
      fiis: agregacao.somaFiis,
      quantidadeAtivos:
        agregacao.quantidadeAtivos + dados.rendaFixa.quantidadeTitulos,
      rendimentos,
    }),
    porClasse: distribuirClasses(itensClasse, patrimonioTotal),
    porSegmento: distribuirSegmentos(itensSegmento, patrimonioTotal),
    consistente: consistencia.consistente,
    diagnostico: {
      somaClasses: consistencia.somaClasses.toFixed(2),
      divergencia: consistencia.divergencia.toFixed(2),
      tolerancia: TOLERANCIA_CONSISTENCIA,
    },
    atualizadoEm: dados.atualizadoEm,
    cotacoes: dados.cotacoes ?? {
      statusDado: STATUS_DADO_INDISPONIVEL,
      dataReferencia: null,
    },
  };
}
