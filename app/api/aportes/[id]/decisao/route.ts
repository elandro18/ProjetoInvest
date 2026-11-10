import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAportes } from "@/src/infra/container/aportes";
import { withRoute, type RouteContext } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { apresentarDecisao } from "@/src/modules/aportes/apresentacao";
import { registrarDecisaoAporte } from "@/src/modules/aportes/registrar-decisao";

/**
 * `PATCH /api/aportes/{id}/decisao` — autenticado (API_CONTRACTS.md §8.3;
 * RN-025-5). ID inválido ou de outro titular responde sempre
 * `APORTE_NAO_ENCONTRADO` (404), nunca 403. A decisão inválida vira
 * `APORTE_DECISAO_INVALIDA` (422) no domínio.
 */

export const dynamic = "force-dynamic";

interface ParametrosSugestao {
  readonly id?: unknown;
}

const decisaoSchema = z.strictObject({
  decisao: z.string().trim().min(1).max(30),
  observacoes: z.string().trim().max(1000).optional(),
});

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

export const PATCH = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const id = await idDaRota(context);
  const corpo = await parseJsonBody(request, decisaoSchema);

  const resultado = await registrarDecisaoAporte(
    {
      usuarioId: usuario.usuarioId,
      sugestaoId: id,
      decisao: corpo.decisao,
      ...(corpo.observacoes === undefined ? {} : { observacoes: corpo.observacoes }),
    },
    servicosAportes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarDecisao(resultado.value), 200, context.requestId);
});
