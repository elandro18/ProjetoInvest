import { z } from "zod";

import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { ipDaRequisicao } from "@/src/infra/auth/ip-hash";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { rateLimit, UMA_HORA_MS, type RateLimitResultado } from "@/src/infra/rate-limit/memory";
import { solicitarRedefinicaoSenha } from "@/src/modules/conta/reset";

/**
 * `POST /api/auth/esqueci-senha` — público (API_CONTRACTS.md §2.4, RN-085).
 *
 * Resposta 202 **sempre neutra**: o mesmo corpo exista ou não a conta. Os
 * limites de 3/h por e-mail e 10/h por IP são a única resposta diferente (429)
 * e são consumidos igualmente nos dois casos, para não revelar cadastro.
 */

export const dynamic = "force-dynamic";

const LIMITE_EMAIL = { limite: 3, janelaMs: UMA_HORA_MS } as const;

const LIMITE_IP = { limite: 10, janelaMs: UMA_HORA_MS } as const;

const esqueciSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
});

function exigirLimite(limite: RateLimitResultado): void {
  if (limite.permitido) {
    return;
  }

  throw errors.rateLimitExcedido({
    retryAfterSegundos: Math.max(1, Math.ceil((limite.redefinirEm.getTime() - Date.now()) / 1000)),
  });
}

export const POST = withRoute(async (request, context) => {
  const { email } = await parseJsonBody(request, esqueciSenhaSchema);
  const ip = ipDaRequisicao(request.headers);

  exigirLimite(rateLimit.consumir(`esqueci-senha:ip:${ip ?? "sem-ip"}`, LIMITE_IP));
  exigirLimite(rateLimit.consumir(`esqueci-senha:email:${email}`, LIMITE_EMAIL));

  const resultado = await solicitarRedefinicaoSenha({ email }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 202, context.requestId);
});
