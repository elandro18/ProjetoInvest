import { dataIsoValida } from "../../lib/datas";
import { errors, type AppError, type FieldError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  PAGE_SIZE_MAXIMO,
  PAGE_SIZE_PADRAO,
  type AporteRepositorio,
  type ResumoSugestaoAporte,
} from "./repositorio";
import type { DecisaoUsuario } from "./tipos";

/**
 * Listagem do histórico de sugestões (RN-052; RN-052-1; API_CONTRACTS.md §8.3).
 *
 * Somente leitura: nada é recalculado nem gravado. A ordem é fixa (`data` desc)
 * e o recorte é sempre o titular da sessão — o `usuarioId` chega do chamador,
 * nunca da query. Cada linha traz só o resumo da distribuição; o snapshot
 * completo é do detalhe (§8.4).
 */

export interface ListarHistoricoComando {
  readonly usuarioId: string;
  /** `YYYY-MM-DD`, inclusivo. */
  readonly de?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  readonly ate?: string;
  readonly decisao?: DecisaoUsuario;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ListarHistoricoDeps {
  readonly repositorio: AporteRepositorio;
}

export interface MetaHistorico {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface HistoricoAportes {
  readonly itens: readonly ResumoSugestaoAporte[];
  readonly meta: MetaHistorico;
}

interface PeriodoHistorico {
  readonly de?: string;
  readonly ate?: string;
}

const MENSAGEM_DATA_INVALIDA = "Data inválida (use YYYY-MM-DD).";

function normalizarPositivo(valor: number | undefined, padrao: number): number {
  if (valor === undefined || !Number.isFinite(valor)) {
    return padrao;
  }
  return Math.max(1, Math.trunc(valor));
}

/** Datas fora de `YYYY-MM-DD` viram `VALIDACAO` (422), com um item por campo. */
function validarPeriodo(
  de: string | undefined,
  ate: string | undefined,
): Result<PeriodoHistorico, AppError> {
  const invalidos: FieldError[] = [];
  if (de !== undefined && !dataIsoValida(de)) {
    invalidos.push({ field: "de", message: MENSAGEM_DATA_INVALIDA });
  }
  if (ate !== undefined && !dataIsoValida(ate)) {
    invalidos.push({ field: "ate", message: MENSAGEM_DATA_INVALIDA });
  }

  if (invalidos.length > 0) {
    return err(errors.validacao(invalidos));
  }

  return ok({
    ...(de === undefined ? {} : { de }),
    ...(ate === undefined ? {} : { ate }),
  });
}

function montarMeta(total: number, page: number, pageSize: number): MetaHistorico {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function listarHistorico(
  comando: ListarHistoricoComando,
  deps: ListarHistoricoDeps,
): Promise<Result<HistoricoAportes, AppError>> {
  const periodo = validarPeriodo(comando.de, comando.ate);
  if (!periodo.ok) {
    return periodo;
  }

  const page = normalizarPositivo(comando.page, 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAXIMO,
    normalizarPositivo(comando.pageSize, PAGE_SIZE_PADRAO),
  );

  const pagina = await deps.repositorio.listarHistorico({
    usuarioId: comando.usuarioId,
    ...periodo.value,
    ...(comando.decisao === undefined ? {} : { decisao: comando.decisao }),
    page,
    pageSize,
  });

  return ok({
    itens: pagina.itens,
    meta: montarMeta(pagina.total, page, pageSize),
  });
}
