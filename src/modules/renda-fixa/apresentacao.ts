import type {
  IndexadorRendaFixa,
  InvestimentoRendaFixaRegistro,
  LiquidezRendaFixa,
  ProdutoRendaFixa,
  StatusSaldo,
} from "./repositorio";

/**
 * Forma pública do título de renda fixa (API_CONTRACTS.md §6.1–§6.3).
 *
 * Lista e detalhe usam o mesmo DTO: campos extras são compatíveis (§15) e a
 * ficha da UI precisa de todos eles sem uma segunda chamada.
 */

export interface RendaFixaApi {
  readonly id: string;
  readonly instituicao: string;
  readonly produto: ProdutoRendaFixa;
  readonly indexador: IndexadorRendaFixa;
  readonly taxa: string;
  readonly dataAplicacao: string;
  readonly vencimento: string | null;
  readonly valorAplicado: string;
  readonly saldoAtual: string;
  readonly statusSaldo: StatusSaldo;
  readonly liquidez: LiquidezRendaFixa;
  readonly carenciaAte: string | null;
  readonly coberturaFgc: boolean;
  readonly observacoes: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export function apresentarRendaFixa(item: InvestimentoRendaFixaRegistro): RendaFixaApi {
  return {
    id: item.id,
    instituicao: item.instituicao,
    produto: item.produto,
    indexador: item.indexador,
    taxa: item.taxa,
    dataAplicacao: item.dataAplicacao,
    vencimento: item.vencimento,
    valorAplicado: item.valorAplicado,
    saldoAtual: item.saldoAtual,
    statusSaldo: item.statusSaldo,
    liquidez: item.liquidez,
    carenciaAte: item.carenciaAte,
    coberturaFgc: item.coberturaFgc,
    observacoes: item.observacoes,
    criadoEm: item.criadoEm.toISOString(),
    atualizadoEm: item.atualizadoEm.toISOString(),
  };
}
