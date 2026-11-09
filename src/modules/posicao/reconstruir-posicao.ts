import { ok, type Result } from "../../lib/result";
import { aplicarMovimentacao, posicaoVazia } from "./aplicar-movimentacao";
import { custoMedio, type EstrategiaBaixa, type OpcoesBaixa } from "./baixa";
import type { ErroPosicao, MovimentacaoParaPosicao, Posicao } from "./tipos";

/**
 * Reconstrução completa da posição (RN-015).
 *
 * `posicao_ativo` é apenas cache: a verdade é a lista de movimentações. A
 * ordem é `(data, criado_em)` — eventos do mesmo dia seguem a ordem em que
 * foram registrados — e movimentações canceladas são ignoradas (RN-084).
 */

function compararMovimentacoes(
  a: MovimentacaoParaPosicao,
  b: MovimentacaoParaPosicao,
): number {
  if (a.data !== b.data) {
    return a.data < b.data ? -1 : 1;
  }

  return a.criadoEm.getTime() - b.criadoEm.getTime();
}

/** Cópia ordenada por `(data, criadoEm)`; não muta a entrada. */
export function ordenarMovimentacoes(
  movimentacoes: readonly MovimentacaoParaPosicao[],
): readonly MovimentacaoParaPosicao[] {
  return [...movimentacoes].sort(compararMovimentacoes);
}

export function reconstruirPosicao(
  movimentacoes: readonly MovimentacaoParaPosicao[],
  estrategia: EstrategiaBaixa = custoMedio,
  opcoes: OpcoesBaixa = {},
): Result<Posicao, ErroPosicao> {
  const ativas = ordenarMovimentacoes(
    movimentacoes.filter((movimentacao) => movimentacao.canceladaEm === null),
  );

  let posicao = posicaoVazia();

  for (const movimentacao of ativas) {
    const resultado = aplicarMovimentacao(posicao, movimentacao, estrategia, opcoes);
    if (!resultado.ok) {
      return resultado;
    }
    posicao = resultado.value;
  }

  return ok(posicao);
}
