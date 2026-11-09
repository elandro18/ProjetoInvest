import type {
  DirecaoOrdem,
  InvestimentoRendaFixaRegistro,
  OrdenacaoRendaFixa,
  ProdutoRendaFixa,
  RendaFixaRepositorio,
} from "./repositorio";

/**
 * Listagem de renda fixa do titular (RN-057-2; API_CONTRACTS.md §6.1).
 *
 * Paginação é normalizada no domínio (mínimo 1, teto de 100) para a borda não
 * duplicar a regra. Filtros vazios não restringem a consulta.
 */

export const PAGE_SIZE_PADRAO = 20;
export const PAGE_SIZE_MAXIMO = 100;

export interface ListarRendaFixaComando {
  readonly usuarioId: string;
  readonly instituicao?: string;
  readonly produto?: ProdutoRendaFixa;
  readonly vencimentoAte?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: OrdenacaoRendaFixa;
  readonly order?: DirecaoOrdem;
}

export interface ListarRendaFixaDeps {
  readonly repositorio: RendaFixaRepositorio;
}

export interface MetaListaRendaFixa {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaRendaFixa {
  readonly itens: readonly InvestimentoRendaFixaRegistro[];
  readonly meta: MetaListaRendaFixa;
}

function normalizarPositivo(valor: number | undefined, padrao: number): number {
  if (valor === undefined || !Number.isFinite(valor)) {
    return padrao;
  }
  return Math.max(1, Math.trunc(valor));
}

export async function listarRendaFixa(
  comando: ListarRendaFixaComando,
  deps: ListarRendaFixaDeps,
): Promise<ListaRendaFixa> {
  const page = normalizarPositivo(comando.page, 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAXIMO,
    normalizarPositivo(comando.pageSize, PAGE_SIZE_PADRAO),
  );
  const instituicao = comando.instituicao?.trim();

  const pagina = await deps.repositorio.listar({
    usuarioId: comando.usuarioId,
    instituicao:
      instituicao !== undefined && instituicao.length > 0 ? instituicao : undefined,
    produto: comando.produto,
    vencimentoAte: comando.vencimentoAte,
    page,
    pageSize,
    sort: comando.sort ?? "vencimento",
    order: comando.order ?? "asc",
  });

  return {
    itens: pagina.itens,
    meta: {
      page,
      pageSize,
      total: pagina.total,
      totalPages: pagina.total === 0 ? 0 : Math.ceil(pagina.total / pageSize),
    },
  };
}
