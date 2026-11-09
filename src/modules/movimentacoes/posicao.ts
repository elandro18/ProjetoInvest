import { ok, type Result } from "../../lib/result";
import { aplicarMovimentacao, posicaoVazia } from "../posicao/aplicar-movimentacao";
import { custoMedio } from "../posicao/baixa";
import { ordenarMovimentacoes } from "../posicao/reconstruir-posicao";
import type { ErroPosicao, MovimentacaoParaPosicao, Posicao } from "../posicao/tipos";
import type { PosicaoPersistida } from "./repositorio";

/**
 * Reconstrução da posição a partir do razão (RN-015).
 *
 * Movimentações já gravadas são reaplicadas em modo permissivo: elas foram
 * validadas quando criadas e uma venda confirmada pode ter deixado a posição
 * negativa (RN-018). A fonte da verdade é sempre `movimentacao`, nunca o cache.
 */
export function reconstruirComExcecoes(
  movimentacoes: readonly MovimentacaoParaPosicao[],
): Result<Posicao, ErroPosicao> {
  const resultado = reconstruirSequencia(ordenarMovimentacoes(movimentacoes), null);
  return resultado.ok ? ok(resultado.value.posicao) : resultado;
}

export interface AplicacaoSequencia {
  readonly posicao: Posicao;
  /** `true` quando a movimentação nova precisou da confirmação explícita. */
  readonly excecaoConfirmada: boolean;
}

/**
 * Ordena o razão com a nova movimentação e aplica tudo em `(data, criadoEm)`.
 *
 * As movimentações existentes são permissivas; a **nova** é estrita, a menos
 * que o titular tenha confirmado a exceção. É isso que garante que uma venda
 * antiga e válida não bloqueie uma compra futura só porque a posição passou
 * por um estado negativo confirmado.
 */
export function aplicarSequenciaComNova(
  existentes: readonly MovimentacaoParaPosicao[],
  nova: MovimentacaoParaPosicao,
  permitirNegativa: boolean,
): Result<AplicacaoSequencia, ErroPosicao> {
  return reconstruirSequencia(ordenarMovimentacoes([...existentes, nova]), {
    novaId: nova.id,
    permitirNegativa,
  });
}

function reconstruirSequencia(
  movimentacoes: readonly MovimentacaoParaPosicao[],
  nova: { readonly novaId: string; readonly permitirNegativa: boolean } | null,
): Result<AplicacaoSequencia, ErroPosicao> {
  let posicao = posicaoVazia();
  let excecaoConfirmada = false;

  for (const movimentacao of movimentacoes) {
    const ehNova = nova !== null && movimentacao.id === nova.novaId;
    const permissiva = ehNova ? nova.permitirNegativa : true;

    const resultado = aplicarMovimentacao(posicao, movimentacao, custoMedio, {
      permitirPosicaoNegativa: permissiva,
    });

    if (!resultado.ok) {
      return resultado;
    }

    if (ehNova && permissiva) {
      excecaoConfirmada = true;
    }

    posicao = resultado.value;
  }

  return ok({ posicao, excecaoConfirmada });
}

/** Cache só recebe posição não negativa (DATA_MODEL.md §6.5). */
export function posicaoParaPersistida(posicao: Posicao): PosicaoPersistida | null {
  if (posicao.quantidade.isNegative()) {
    return null;
  }

  return {
    quantidade: posicao.quantidade.toFixed(8),
    precoMedio: posicao.precoMedio.toFixed(6),
    custoTotal: posicao.custoTotal.toFixed(2),
  };
}
