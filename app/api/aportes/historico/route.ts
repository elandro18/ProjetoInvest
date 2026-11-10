import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAportes } from "@/src/infra/container/aportes";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { validate } from "@/src/infra/http/validation";
import { dataIsoValida } from "@/src/lib/datas";
import { isErr } from "@/src/lib/result";
import { apresentarResumoHistorico } from "@/src/modules/aportes/apresentacao";
import { listarHistorico } from "@/src/modules/aportes/listar-historico";
import {
  PAGE_SIZE_MAXIMO,
  PAGE_SIZE_PADRAO,
} from "@/src/modules/aportes/repositorio";
import { DECISOES_USUARIO } from "@/src/modules/aportes/tipos";

/**
 * `GET /api/aportes/historico` — autenticado (API_CONTRACTS.md §8.3;
 * RN-052-1). Somente leitura: lista as sugestões do titular da sessão em
 * ordem de `data` desc, com filtros de período e decisão e paginação de no
 * máximo 100 itens. O `usuarioId` vem exclusivamente da sessão, nunca da
 * query. Filtro fora do formato responde `VALIDACAO` (422).
 */

export const dynamic = "force-dynamic";

const dataIso = z.string().refine(dataIsoValida, "Data inválida (use YYYY-MM-DD).");

const listarHistoricoSchema = z.object({
  de: dataIso.optional(),
  ate: dataIso.optional(),
  decisao: z.enum(DECISOES_USUARIO).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAXIMO)
    .default(PAGE_SIZE_PADRAO),
});

export const GET = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const query = validate(
    listarHistoricoSchema,
    Object.fromEntries(new URL(request.url).searchParams),
  );

  const resultado = await listarHistorico(
    { usuarioId: usuario.usuarioId, ...query },
    servicosAportes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(
    {
      data: resultado.value.itens.map(apresentarResumoHistorico),
      meta: resultado.value.meta,
    },
    200,
    context.requestId,
  );
});
