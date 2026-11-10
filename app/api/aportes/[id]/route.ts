import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAportes } from "@/src/infra/container/aportes";
import { withRoute, type RouteContext } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { apresentarDetalheSugestao } from "@/src/modules/aportes/apresentacao";
import { obterSugestaoAporte } from "@/src/modules/aportes/obter-sugestao";

/**
 * `GET /api/aportes/{id}` — autenticado (API_CONTRACTS.md §8.4; RN-052-1).
 *
 * Devolve o snapshot completo da sugestão (RN-025) com a decisão registrada
 * (RN-053). Somente leitura. ID inválido, inexistente ou de outro titular
 * responde sempre `APORTE_NAO_ENCONTRADO` (404), nunca 403 (RN-070).
 */

export const dynamic = "force-dynamic";

interface ParametrosSugestao {
  readonly id?: unknown;
}

async function idDaRota(context: RouteContext): Promise<string> {
  const params = context.params as
    | Promise<ParametrosSugestao>
    | ParametrosSugestao
    | undefined;
  const resolvidos = await params;
  const id = resolvidos?.id;

  if (typeof id !== "string" || !z.uuid().safeParse(id).success) {
    throw errors.aporteNaoEncontrado();
  }
  return id;
}

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();
  const id = await idDaRota(context);

  const resultado = await obterSugestaoAporte(
    { usuarioId: usuario.usuarioId, sugestaoId: id },
    servicosAportes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(
    apresentarDetalheSugestao(resultado.value),
    200,
    context.requestId,
  );
});
