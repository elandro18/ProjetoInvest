import { Decimal } from "../../lib/decimal";

/**
 * Motor de priorização por gap (RN-025, RN-026, RN-027, RN-054; RN-025-2).
 *
 * Regra central: **water-filling por diferença em reais sobre o patrimônio
 * pós-aporte**. A classe com maior gap (`meta% × totalPós − valorAtual`)
 * recebe primeiro, limitada ao próprio gap; o que sobra passa para a próxima.
 * Não existe rateio igual entre classes (RN-026).
 *
 * Quando nenhum gap positivo resta, o valor é distribuído na proporção das
 * metas — ainda é uma sugestão útil, apenas sem classe "abaixo da meta".
 * A parcela dos FIIs é redistribuída entre os segmentos com a mesma regra,
 * sempre limitada ao que a classe recebeu.
 *
 * Domínio puro: nenhum Prisma, `next` ou I/O. Os valores chegam já carregados.
 */

export interface LinhaMetaAporte {
  readonly codigo: string;
  readonly nome: string;
  readonly valorAtual: string;
  /** Meta do escopo com 6 casas (`"50.000000"`). */
  readonly percentualMeta: string;
}

export interface EntradaMotor {
  /** Patrimônio atual com 2 casas. */
  readonly totalAtual: string;
  /** Valor disponível para aporte, estritamente positivo, com 2 casas. */
  readonly valorAporte: string;
  readonly classes: readonly LinhaMetaAporte[];
  readonly segmentos: readonly LinhaMetaAporte[];
  /** Classe cuja parcela é redistribuída entre os segmentos; default `FII`. */
  readonly codigoClasseFii?: string;
}

export interface LinhaDistribuicao {
  readonly codigo: string;
  /** Valor alocado com 2 casas. */
  readonly valor: string;
  readonly justificativa: string;
}

export interface DistribuicaoMotor {
  /** Total atual + aporte, com 2 casas. */
  readonly totalPosAporte: string;
  readonly classes: readonly LinhaDistribuicao[];
  readonly segmentos: readonly LinhaDistribuicao[];
  /** Parcela destinada à classe de FII, com 2 casas. */
  readonly valorFii: string;
}

const CODIGO_FII_PADRAO = "FII";
const ESCALA_PERCENTUAL = 6;
const ESCALA_MONETARIA = 2;

interface LinhaCalculada {
  readonly codigo: string;
  readonly nome: string;
  readonly valorAtual: Decimal;
  readonly percentualMeta: Decimal;
  valor: Decimal;
}

/** `1.234,56` — formatação determinística, sem `Intl`/`number` (ADR-006). */
function formatarDecimal(valor: Decimal, casas: number): string {
  const fixed = valor.abs().round(casas).toFixed(casas);
  const [inteiro, decimal] = fixed.split(".");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal === undefined ? comMilhar : `${comMilhar},${decimal}`;
}

export function formatarMoeda(valor: Decimal): string {
  return `R$ ${formatarDecimal(valor, ESCALA_MONETARIA)}`;
}

function formatarPontos(valor: Decimal): string {
  return `${formatarDecimal(valor, ESCALA_MONETARIA)} p.p.`;
}

function gapDaLinha(linha: LinhaCalculada, totalPos: Decimal): Decimal {
  return totalPos.mul(linha.percentualMeta).div("100", ESCALA_PERCENTUAL).sub(linha.valorAtual);
}

/**
 * Aplica o resíduo do arredondamento na maior linha, garantindo soma exata.
 * Se a maior linha não comportar o resíduo negativo, a próxima é usada.
 */
function aplicarResiduo(linhas: readonly LinhaCalculada[], orcamento: Decimal): void {
  if (linhas.length === 0) {
    return;
  }

  const arredondadas = linhas.map((linha) => ({
    linha,
    valor: linha.valor.round(ESCALA_MONETARIA),
  }));

  let soma = Decimal.zero(ESCALA_MONETARIA);
  for (const item of arredondadas) {
    item.linha.valor = item.valor;
    soma = soma.add(item.valor);
  }

  const residuo = orcamento.sub(soma).round(ESCALA_MONETARIA);
  if (residuo.isZero()) {
    return;
  }

  const porMaior = [...arredondadas].sort(
    (a, b) => b.valor.compare(a.valor) || a.linha.codigo.localeCompare(b.linha.codigo),
  );

  for (const item of porMaior) {
    if (item.linha.valor.add(residuo).gte("0")) {
      item.linha.valor = item.linha.valor.add(residuo);
      return;
    }
  }

  // Todos negativos: devolve ao maior mesmo assim (não ocorre com metas reais).
  const maior = porMaior[0];
  if (maior !== undefined) {
    maior.linha.valor = maior.linha.valor.add(residuo);
  }
}

/** Water-filling puro: maior gap primeiro, limitado ao gap; sobra pela meta. */
function alocar(
  linhas: readonly LinhaMetaAporte[],
  orcamento: Decimal,
  totalPos: Decimal,
): LinhaCalculada[] {
  if (linhas.length === 0 || orcamento.isZero()) {
    return linhas.map((linha) => ({
      codigo: linha.codigo,
      nome: linha.nome,
      valorAtual: Decimal.from(linha.valorAtual),
      percentualMeta: Decimal.from(linha.percentualMeta),
      valor: Decimal.zero(ESCALA_MONETARIA),
    }));
  }

  const calculadas: LinhaCalculada[] = linhas.map((linha) => ({
    codigo: linha.codigo,
    nome: linha.nome,
    valorAtual: Decimal.from(linha.valorAtual),
    percentualMeta: Decimal.from(linha.percentualMeta),
    valor: Decimal.zero(ESCALA_MONETARIA),
  }));

  const comGap = calculadas
    .map((linha) => ({ linha, gap: gapDaLinha(linha, totalPos) }))
    .filter((item) => item.gap.gt("0"))
    .sort((a, b) => b.gap.compare(a.gap) || a.linha.codigo.localeCompare(b.linha.codigo));

  let restante = orcamento;
  for (const item of comGap) {
    if (!restante.gt("0")) {
      break;
    }

    const parcela = restante.gt(item.gap) ? item.gap : restante;
    item.linha.valor = parcela;
    restante = restante.sub(parcela);
  }

  if (restante.gt("0")) {
    const somaMetas = calculadas.reduce(
      (total, linha) => total.add(linha.percentualMeta),
      Decimal.zero(ESCALA_PERCENTUAL),
    );

    if (somaMetas.gt("0")) {
      for (const linha of calculadas) {
        const parcela = restante.mul(linha.percentualMeta).div(somaMetas, ESCALA_PERCENTUAL);
        linha.valor = linha.valor.add(parcela);
      }
    } else {
      // Defensivo: catálogo sem meta não deveria chegar aqui.
      const igual = restante.div(String(calculadas.length), ESCALA_PERCENTUAL);
      for (const linha of calculadas) {
        linha.valor = linha.valor.add(igual);
      }
    }
  }

  aplicarResiduo(calculadas, orcamento);
  return calculadas;
}

function montarJustificativa(linha: LinhaCalculada, totalPos: Decimal): string {
  const percentualAtual = linha.valorAtual.mul("100").div(totalPos, ESCALA_PERCENTUAL);
  const desvio = percentualAtual.sub(linha.percentualMeta).round(ESCALA_MONETARIA);

  let posicao: string;
  if (desvio.isZero()) {
    posicao = "está na meta";
  } else if (desvio.isNegative()) {
    posicao = `está ${formatarPontos(desvio)} abaixo da meta`;
  } else {
    posicao = `está ${formatarPontos(desvio)} acima da meta`;
  }

  const destino = linha.valor.isZero()
    ? "não recebe aporte"
    : `recebe ${formatarMoeda(linha.valor)}`;

  return `${linha.nome} ${posicao} e ${destino}.`;
}

function apresentar(linhas: readonly LinhaCalculada[], totalPos: Decimal): LinhaDistribuicao[] {
  return linhas.map((linha) => ({
    codigo: linha.codigo,
    valor: linha.valor.toFixed(ESCALA_MONETARIA),
    justificativa: montarJustificativa(linha, totalPos),
  }));
}

export function calcularDistribuicao(entrada: EntradaMotor): DistribuicaoMotor {
  const totalAtual = Decimal.from(entrada.totalAtual);
  const valorAporte = Decimal.from(entrada.valorAporte);
  const totalPos = totalAtual.add(valorAporte);

  const classes = alocar(entrada.classes, valorAporte, totalPos);
  const codigoFii = entrada.codigoClasseFii ?? CODIGO_FII_PADRAO;
  const parcelaFii =
    classes.find((linha) => linha.codigo === codigoFii)?.valor ?? Decimal.zero(ESCALA_MONETARIA);
  const segmentos = alocar(entrada.segmentos, parcelaFii, totalPos);

  return {
    totalPosAporte: totalPos.toFixed(ESCALA_MONETARIA),
    classes: apresentar(classes, totalPos),
    segmentos: apresentar(segmentos, totalPos),
    valorFii: parcelaFii.toFixed(ESCALA_MONETARIA),
  };
}
