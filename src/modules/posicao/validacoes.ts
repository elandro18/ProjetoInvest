import { Decimal, type DecimalInput } from "../../lib/decimal";
import { err, ok, type Result } from "../../lib/result";
import {
  erroPosicaoNegativa,
  erroValorInconsistente,
} from "./erros";
import type { ErroPosicao, Posicao } from "./tipos";

/**
 * Regras de validação compartilhadas pelo cálculo de posição.
 *
 * - RN-019: `valor_total = quantidade × valor_unitário + custos`, com
 *   tolerância de R$ 0,01 para absorver arredondamento de nota de corretagem.
 * - RN-018: venda que deixaria a quantidade negativa é bloqueada.
 */

/** Tolerância monetária da RN-019 (R$ 0,01). Exportada para a borda reutilizar. */
export const TOLERANCIA_VALOR_TOTAL = Decimal.from("0.01");

export interface DadosValidacaoValorTotal {
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly custos: string;
  readonly valorTotal: string;
}

export interface ValorTotalValidado {
  readonly valorTotalCalculado: Decimal;
  /** Diferença absoluta entre informado e calculado (`>= 0`). */
  readonly diferenca: Decimal;
}

/**
 * Confere a consistência do valor total.
 *
 * Sem quantidade ou valor unitário (ex.: dividendo, taxa) não há o que
 * conferir: o valor informado é aceito. Com ambos presentes, a diferença
 * acima da tolerância devolve `MOV_VALOR_INCONSISTENTE` para a borda exigir
 * observação.
 */
export function validarValorTotal(
  dados: DadosValidacaoValorTotal,
): Result<ValorTotalValidado, ErroPosicao> {
  if (dados.quantidade === null || dados.valorUnitario === null) {
    return ok({
      valorTotalCalculado: Decimal.from(dados.valorTotal),
      diferenca: Decimal.zero(2),
    });
  }

  const calculado = Decimal.from(dados.quantidade)
    .mul(dados.valorUnitario)
    .add(dados.custos);
  const informado = Decimal.from(dados.valorTotal);
  const diferenca = informado.sub(calculado).abs();

  if (diferenca.gt(TOLERANCIA_VALOR_TOTAL)) {
    return err(erroValorInconsistente(informado, calculado, diferenca));
  }

  return ok({ valorTotalCalculado: calculado, diferenca });
}

/** Venda só é válida quando a quantidade resultante não é negativa (RN-018). */
export function validarVenda(
  posicao: Posicao,
  quantidade: DecimalInput,
): Result<true, ErroPosicao> {
  const solicitada = Decimal.from(quantidade);
  const resultante = posicao.quantidade.sub(solicitada);

  if (resultante.isNegative()) {
    return err(erroPosicaoNegativa(posicao.quantidade, solicitada, resultante));
  }

  return ok(true);
}
