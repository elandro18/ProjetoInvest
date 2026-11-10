import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAportes } from "@/src/infra/container/aportes";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { dataIsoValida } from "@/src/lib/datas";
import { isErr } from "@/src/lib/result";
import { apresentarSugestao } from "@/src/modules/aportes/apresentacao";
import { criarSugestaoAporte } from "@/src/modules/aportes/criar-sugestao";

/**
 * `POST /api/aportes/sugestao` — autenticado (API_CONTRACTS.md §8.1;
 * RN-025-4). O `usuarioId` vem exclusivamente da sessão. A borda valida a
 * forma; valor > 0, metas lazy e persistência ficam no caso de uso.
 */

export const dynamic = "force-dynamic";

const dataIso = z.string().refine(dataIsoValida, "Data inválida (use YYYY-MM-DD).");

const criarSugestaoSchema = z.strictObject({
  valorDisponivel: z.string().trim().min(1).max(30),
  data: dataIso.optional(),
});

export const POST = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, criarSugestaoSchema);

  const resultado = await criarSugestaoAporte(
    {
      usuarioId: usuario.usuarioId,
      valorDisponivel: corpo.valorDisponivel,
      ...(corpo.data === undefined ? {} : { data: corpo.data }),
    },
    servicosAportes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarSugestao(resultado.value), 201, context.requestId);
});
