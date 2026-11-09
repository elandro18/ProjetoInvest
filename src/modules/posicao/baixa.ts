import { Decimal } from "../../lib/decimal";
import { err, ok, type Result } from "../../lib/result";
import { erroQuantidadeObrigatoria } from "./erros";
import type { ErroPosicao, MovimentacaoParaPosicao, Posicao } from "./tipos";
import { validarVenda } from "./validacoes";

/**
 * Estratégia de baixa em venda (RN-016; `PEND-005`).
 *
 * O método padrão é o custo médio: a venda baixa o custo proporcional e
 * preserva o preço médio. A regra fica isolada atrás de `EstrategiaBaixa`
 * para permitir a troca por PEPS sem reescrever o cálculo de posição.
 */

const ESCALA_CUSTO_BAIXADO = 12;
const ESCALA_PRECO_MEDIO = 10;

export interface ResultadoBaixa {
  /** Posição após a venda. */
  readonly posicao: Posicao;
  /** Custo proporcional baixado. */
  readonly custoBaixado: Decimal;
  /** `receita - custo baixado - custos` (RN-017 separa do rendimento). */
  readonly resultadoRealizado: Decimal;
}

export interface EstrategiaBaixa {
  readonly nome: string;

  calcularBaixa(
    posicao: Posicao,
    movimentacao: MovimentacaoParaPosicao,
    opcoes?: OpcoesBaixa,
  ): Result<ResultadoBaixa, ErroPosicao>;
}

/**
 * Opções de aplicação da baixa.
 *
 * `permitirPosicaoNegativa` só é ligado quando o titular confirmou
 * explicitamente a exceção (RN-018): a venda é aceita e a quantidade pode
 * ficar negativa. Sem a confirmação o comportamento padrão continua bloqueando.
 */
export interface OpcoesBaixa {
  readonly permitirPosicaoNegativa?: boolean;
}

/** Preço médio com precisão interna; zero quando não há quantidade. */
export function calcularPrecoMedio(
  custoTotal: Decimal,
  quantidade: Decimal,
): Decimal {
  if (quantidade.isZero()) {
    return Decimal.zero(6);
  }

  return custoTotal.div(quantidade, ESCALA_PRECO_MEDIO);
}

export const custoMedio: EstrategiaBaixa = {
  nome: "custo-medio",

  calcularBaixa(posicao, movimentacao, opcoes = {}) {
    if (movimentacao.quantidade === null || movimentacao.valorUnitario === null) {
      return err(erroQuantidadeObrigatoria(movimentacao.tipo));
    }

    const quantidadeVendida = Decimal.from(movimentacao.quantidade);
    if (!quantidadeVendida.isPositive() || quantidadeVendida.isZero()) {
      return err(erroQuantidadeObrigatoria(movimentacao.tipo));
    }

    if (opcoes.permitirPosicaoNegativa !== true) {
      const validacao = validarVenda(posicao, quantidadeVendida);
      if (!validacao.ok) {
        return validacao;
      }
    }

    // Sem quantidade em carteira não há custo a baixar (venda confirmada que
    // deixa a posição negativa). A quantidade pode ficar negativa, mas o custo
    // e o preço médio nunca ficam: o ativo passa a ter posição descoberta.
    const custoBaixado =
      posicao.quantidade.isPositive() && !posicao.quantidade.isZero()
        ? posicao.custoTotal.mul(quantidadeVendida).div(posicao.quantidade, ESCALA_CUSTO_BAIXADO)
        : Decimal.zero(2);
    const quantidadeResultante = posicao.quantidade.sub(quantidadeVendida);
    const custoResultanteBruto = posicao.custoTotal.sub(custoBaixado);
    const semPosicao = quantidadeResultante.isNegative() || quantidadeResultante.isZero();
    const custoResultante = semPosicao ? Decimal.zero(2) : custoResultanteBruto;

    const posicaoResultante: Posicao = {
      quantidade: quantidadeResultante,
      precoMedio: semPosicao
        ? Decimal.zero(6)
        : calcularPrecoMedio(custoResultante, quantidadeResultante),
      custoTotal: custoResultante,
    };

    const valorUnitario = Decimal.from(movimentacao.valorUnitario);
    const custos = Decimal.from(movimentacao.custos);
    const resultadoRealizado = quantidadeVendida
      .mul(valorUnitario)
      .sub(custoBaixado)
      .sub(custos);

    return ok({ posicao: posicaoResultante, custoBaixado, resultadoRealizado });
  },
};

/** Ponto de entrada da baixa; permite injetar outra estratégia (ex.: PEPS). */
export function calcularBaixaVenda(
  posicao: Posicao,
  movimentacao: MovimentacaoParaPosicao,
  estrategia: EstrategiaBaixa = custoMedio,
  opcoes: OpcoesBaixa = {},
): Result<ResultadoBaixa, ErroPosicao> {
  return estrategia.calcularBaixa(posicao, movimentacao, opcoes);
}
