import { Decimal } from "../../lib/decimal";
import { err, ok, type Result } from "../../lib/result";
import {
  calcularPrecoMedio,
  custoMedio,
  type EstrategiaBaixa,
  type OpcoesBaixa,
} from "./baixa";
import { erroQuantidadeObrigatoria } from "./erros";
import type { ErroPosicao, MovimentacaoParaPosicao, Posicao } from "./tipos";

/** Posição inicial neutra de um ativo sem movimentações. */
export function posicaoVazia(): Posicao {
  return {
    quantidade: Decimal.zero(8),
    precoMedio: Decimal.zero(6),
    custoTotal: Decimal.zero(2),
  };
}

/**
 * Aplica uma movimentação sobre a posição (RN-015, RN-016).
 *
 * - `COMPRA`: soma quantidade e custo de aquisição (`valor_total`, que inclui
 *   custos) e recalcula o preço médio ponderado.
 * - `VENDA`: delega à estratégia de baixa (custo médio por padrão).
 * - Demais tipos (dividendo, juros, aplicação/resgate de RF, taxa): não
 *   alteram a posição — rendimento é registrado à parte (RN-017).
 */
export function aplicarMovimentacao(
  posicao: Posicao,
  movimentacao: MovimentacaoParaPosicao,
  estrategia: EstrategiaBaixa = custoMedio,
  opcoes: OpcoesBaixa = {},
): Result<Posicao, ErroPosicao> {
  switch (movimentacao.tipo) {
    case "COMPRA": {
      if (movimentacao.quantidade === null) {
        return err(erroQuantidadeObrigatoria(movimentacao.tipo));
      }

      const quantidadeComprada = Decimal.from(movimentacao.quantidade);
      if (!quantidadeComprada.isPositive() || quantidadeComprada.isZero()) {
        return err(erroQuantidadeObrigatoria(movimentacao.tipo));
      }

      const quantidade = posicao.quantidade.add(quantidadeComprada);
      const custoTotal = posicao.custoTotal.add(movimentacao.valorTotal);

      return ok({
        quantidade,
        custoTotal,
        precoMedio: calcularPrecoMedio(custoTotal, quantidade),
      });
    }

    case "VENDA": {
      const baixa = estrategia.calcularBaixa(posicao, movimentacao, opcoes);
      return baixa.ok ? ok(baixa.value.posicao) : baixa;
    }

    default:
      return ok(posicao);
  }
}
