import type { Posicao, TipoMovimentacao } from "../posicao/tipos";
import type { MovimentacaoRegistro } from "./repositorio";

/**
 * Forma pública da movimentação (API_CONTRACTS.md §4.1–§4.3).
 *
 * Dinheiro e quantidade saem como string decimal na escala do contrato
 * (quantidade 8, dinheiro 2, preço médio 6). Datas de negócio em `YYYY-MM-DD`
 * e instantes em ISO-8601.
 */

export interface AtivoMovimentacaoApi {
  readonly id: string;
  readonly ticker: string;
}

export interface MovimentacaoApi {
  readonly id: string;
  readonly ativo: AtivoMovimentacaoApi;
  readonly tipo: TipoMovimentacao;
  readonly data: string;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly observacoes: string | null;
  readonly canceladaEm: string | null;
  readonly cancelamentoMotivo: string | null;
  readonly criadoEm: string;
}

export interface PosicaoApi {
  readonly quantidade: string;
  readonly precoMedio: string;
  readonly custoTotal: string;
}

export function apresentarMovimentacao(item: MovimentacaoRegistro): MovimentacaoApi {
  return {
    id: item.id,
    ativo: { id: item.ativo.id, ticker: item.ativo.ticker },
    tipo: item.tipo,
    data: item.data,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotal: item.valorTotal,
    custos: item.custos,
    observacoes: item.observacoes,
    canceladaEm: item.canceladaEm === null ? null : item.canceladaEm.toISOString(),
    cancelamentoMotivo: item.cancelamentoMotivo,
    criadoEm: item.criadoEm.toISOString(),
  };
}

export function apresentarPosicao(posicao: Posicao): PosicaoApi {
  return {
    quantidade: posicao.quantidade.toFixed(8),
    precoMedio: posicao.precoMedio.toFixed(6),
    custoTotal: posicao.custoTotal.toFixed(2),
  };
}
