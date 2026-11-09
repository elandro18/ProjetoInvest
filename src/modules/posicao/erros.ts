import { Decimal } from "../../lib/decimal";
import type { CodigoErroPosicao, ErroPosicao, TipoMovimentacao } from "./tipos";

/**
 * Factories de erro do cálculo de posição.
 *
 * As mensagens espelham `specs/ERROR_CATALOG.md` §5; os detalhes são strings
 * decimais já normalizadas na escala do contrato (quantidade 8 casas, dinheiro
 * 2 casas) para não vazar `number` na borda (ADR-006).
 */

const MENSAGENS: Readonly<Record<CodigoErroPosicao, string>> = {
  MOV_POSICAO_NEGATIVA: "A movimentação deixaria a posição negativa.",
  MOV_VALOR_INCONSISTENTE:
    "O valor total não confere com quantidade × valor unitário + custos.",
  MOV_QTD_OBRIGATORIA: "Informe quantidade e valor unitário.",
};

function erro(
  codigo: CodigoErroPosicao,
  detalhes: Readonly<Record<string, string>>,
): ErroPosicao {
  return { codigo, mensagem: MENSAGENS[codigo], detalhes };
}

function quantidade(valor: Decimal): string {
  return valor.toFixed(8);
}

function dinheiro(valor: Decimal): string {
  return valor.toFixed(2);
}

export function erroPosicaoNegativa(
  quantidadeAtual: Decimal,
  quantidadeSolicitada: Decimal,
  quantidadeResultante: Decimal,
): ErroPosicao {
  return erro("MOV_POSICAO_NEGATIVA", {
    quantidadeAtual: quantidade(quantidadeAtual),
    quantidadeSolicitada: quantidade(quantidadeSolicitada),
    quantidadeResultante: quantidade(quantidadeResultante),
  });
}

export function erroValorInconsistente(
  valorTotalInformado: Decimal,
  valorTotalCalculado: Decimal,
  diferenca: Decimal,
): ErroPosicao {
  return erro("MOV_VALOR_INCONSISTENTE", {
    valorTotalInformado: dinheiro(valorTotalInformado),
    valorTotalCalculado: dinheiro(valorTotalCalculado),
    diferenca: dinheiro(diferenca),
  });
}

export function erroQuantidadeObrigatoria(tipo: TipoMovimentacao): ErroPosicao {
  return erro("MOV_QTD_OBRIGATORIA", { tipo });
}
