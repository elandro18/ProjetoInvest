import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAportes } from "@/src/infra/container/aportes";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { isErr } from "@/src/lib/result";
import { simularAporte } from "@/src/modules/aportes/simular-aporte";

/**
 * `POST /api/aportes/simulacao` — autenticado e stateless
 * (API_CONTRACTS.md §8.2; RN-028-1).
 *
 * O `usuarioId` vem exclusivamente da sessão. A borda valida a forma; valor
 * > 0, metas lazy (RN-021) e o comparativo ficam no caso de uso — que só lê,
 * nunca grava sugestão nem altera a carteira.
 */

export const dynamic = "force-dynamic";

const simulacaoSchema = z.strictObject({
  valorAporte: z.string().trim().min(1).max(30),
});

export const POST = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, simulacaoSchema);

  const resultado = await simularAporte(
    { usuarioId: usuario.usuarioId, valorAporte: corpo.valorAporte },
    servicosAportes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 200, context.requestId);
});
