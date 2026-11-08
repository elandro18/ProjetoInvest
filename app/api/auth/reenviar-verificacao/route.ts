import { z } from "zod";

import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { rateLimit, UMA_HORA_MS } from "@/src/infra/rate-limit/memory";
import { reenviarVerificacao } from "@/src/modules/conta/reenvio";

/**
 * `POST /api/auth/reenviar-verificacao` — público (API_CONTRACTS.md §2.3, RN-085).
 *
 * Resposta 202 **sempre neutra**: o mesmo corpo exista ou não a conta. O
 * rate limit de 3/h por e-mail é a única resposta diferente (429).
 */

export const dynamic = "force-dynamic";

const REENVIO_LIMITE = { limite: 3, janelaMs: UMA_HORA_MS } as const;

const reenvioSchema = z.object({
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
});

export const POST = withRoute(async (request, context) => {
  const { email } = await parseJsonBody(request, reenvioSchema);

  const limite = rateLimit.consumir(`reenvio:${email}`, REENVIO_LIMITE);
  if (!limite.permitido) {
    throw errors.rateLimitExcedido({
      retryAfterSegundos: Math.max(1, Math.ceil((limite.redefinirEm.getTime() - Date.now()) / 1000)),
    });
  }

  const resultado = await reenviarVerificacao({ email }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 202, context.requestId);
});
