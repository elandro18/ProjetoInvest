import type {
  AtivoRegistro,
  AtivoRepositorio,
  DirecaoOrdem,
  OrdenacaoAtivo,
  StatusAtivo,
} from "./repositorio";

/**
 * Listagem de ativos do titular (RN-010-2; API_CONTRACTS.md §3.1).
 *
 * Paginação é normalizada no domínio (mínimo 1, teto de 100) para a borda não
 * precisar duplicar a regra; o filtro textual fica a cargo do repositório.
 */

export const PAGE_SIZE_PADRAO = 20;
export const PAGE_SIZE_MAXIMO = 100;

export interface ListarAtivosComando {
  readonly usuarioId: string;
  readonly q?: string;
  readonly classeId?: string;
  readonly segmentoId?: string;
  readonly status?: StatusAtivo;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: OrdenacaoAtivo;
  readonly order?: DirecaoOrdem;
}

export interface ListarAtivosDeps {
  readonly repositorio: AtivoRepositorio;
}

export interface MetaListaAtivos {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaAtivos {
  readonly itens: readonly AtivoRegistro[];
  readonly meta: MetaListaAtivos;
}

function normalizarPositivo(valor: number | undefined, padrao: number): number {
  if (valor === undefined || !Number.isFinite(valor)) {
    return padrao;
  }
  return Math.max(1, Math.trunc(valor));
}

export async function listarAtivos(
  comando: ListarAtivosComando,
  deps: ListarAtivosDeps,
): Promise<ListaAtivos> {
  const page = normalizarPositivo(comando.page, 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAXIMO,
    normalizarPositivo(comando.pageSize, PAGE_SIZE_PADRAO),
  );
  const q = comando.q?.trim();

  const pagina = await deps.repositorio.listar({
    usuarioId: comando.usuarioId,
    q: q !== undefined && q.length > 0 ? q : undefined,
    classeId: comando.classeId,
    segmentoId: comando.segmentoId,
    status: comando.status,
    page,
    pageSize,
    sort: comando.sort ?? "ticker",
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
