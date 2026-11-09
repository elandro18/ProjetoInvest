import { errors, type AppError } from "../../lib/errors";
import { dataIsoValida } from "../../lib/datas";
import { err, ok, type Result } from "../../lib/result";
import type { TipoMovimentacao } from "../posicao/tipos";
import {
  PAGE_SIZE_MAXIMO,
  PAGE_SIZE_PADRAO,
  type DirecaoOrdem,
  type MovimentacaoRegistro,
  type MovimentacaoRepositorio,
  type OrdenacaoMovimentacao,
} from "./repositorio";

/** Listagem de movimentações (RN-014-4; API_CONTRACTS.md §4.1). */

export interface ListarMovimentacoesComando {
  readonly usuarioId: string;
  readonly ativoId?: string;
  readonly tipo?: TipoMovimentacao;
  readonly de?: string;
  readonly ate?: string;
  readonly incluirCanceladas?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: OrdenacaoMovimentacao;
  readonly order?: DirecaoOrdem;
}

export interface ListarMovimentacoesDeps {
  readonly repositorio: MovimentacaoRepositorio;
}

export interface MetaListaMovimentacoes {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaMovimentacoes {
  readonly itens: readonly MovimentacaoRegistro[];
  readonly meta: MetaListaMovimentacoes;
}

function normalizarPositivo(valor: number | undefined, padrao: number): number {
  if (valor === undefined || !Number.isFinite(valor)) {
    return padrao;
  }
  return Math.max(1, Math.trunc(valor));
}

function validarData(nome: string, valor: string | undefined): Result<string | undefined, AppError> {
  if (valor === undefined) {
    return ok(undefined);
  }
  if (!dataIsoValida(valor)) {
    return err(
      errors.validacao([{ field: nome, message: "Data inválida (use YYYY-MM-DD)." }]),
    );
  }
  return ok(valor);
}

export async function listarMovimentacoes(
  comando: ListarMovimentacoesComando,
  deps: ListarMovimentacoesDeps,
): Promise<Result<ListaMovimentacoes, AppError>> {
  const de = validarData("de", comando.de);
  if (!de.ok) {
    return de;
  }

  const ate = validarData("ate", comando.ate);
  if (!ate.ok) {
    return ate;
  }

  const page = normalizarPositivo(comando.page, 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAXIMO,
    normalizarPositivo(comando.pageSize, PAGE_SIZE_PADRAO),
  );

  const pagina = await deps.repositorio.listar({
    usuarioId: comando.usuarioId,
    ativoId: comando.ativoId,
    tipo: comando.tipo,
    de: de.value,
    ate: ate.value,
    incluirCanceladas: comando.incluirCanceladas === true,
    page,
    pageSize,
    sort: comando.sort ?? "data",
    order: comando.order ?? "desc",
  });

  return ok({
    itens: pagina.itens,
    meta: {
      page,
      pageSize,
      total: pagina.total,
      totalPages: pagina.total === 0 ? 0 : Math.ceil(pagina.total / pageSize),
    },
  });
}
