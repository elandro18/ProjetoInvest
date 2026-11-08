import { z } from "zod";

import { isErr } from "@/src/lib/result";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { verificarEmail } from "@/src/modules/conta/verificacao";

/**
 * `POST /api/auth/verificar-email` — público (API_CONTRACTS.md §2.2, RN-085).
 *
 * Token opaco de uso único: o hash é procurado no banco, a expiração e o uso
 * são decididos no caso de uso e a conta passa a `ATIVA` na mesma transação
 * que grava `usado_em`.
 */

export const dynamic = "force-dynamic";

const verificacaoSchema = z.object({
  token: z.string().trim().min(1),
});

export const POST = withRoute(async (request, context) => {
  const { token } = await parseJsonBody(request, verificacaoSchema);

  const resultado = await verificarEmail({ token }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 200, context.requestId);
});
