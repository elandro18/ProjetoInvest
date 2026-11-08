import { z } from "zod";

import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { ipDaRequisicao, hashIp } from "@/src/infra/auth/ip-hash";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { rateLimit, UMA_HORA_MS } from "@/src/infra/rate-limit/memory";
import { cadastrar } from "@/src/modules/conta/cadastro";

/**
 * `POST /api/auth/cadastro` — público (API_CONTRACTS.md §2.1, RN-085).
 *
 * A borda valida a forma (Zod → `VALIDACAO` 422), aplica o rate limit de
 * 10/h por IP + e-mail e delega as regras de negócio ao caso de uso. A
 * resposta é sempre o identificador público da conta — nunca o hash.
 */

export const dynamic = "force-dynamic";

const CADASTRO_LIMITE = { limite: 10, janelaMs: UMA_HORA_MS } as const;

const cadastroSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
  senha: z.string(),
  aceiteTermos: z.boolean().optional().default(false),
  aceitePrivacidade: z.boolean().optional().default(false),
  versaoTermos: z.string().optional().default(""),
  versaoPrivacidade: z.string().optional().default(""),
});

export const POST = withRoute(async (request, context) => {
  const corpo = await parseJsonBody(request, cadastroSchema);
  const ip = ipDaRequisicao(request.headers);

  const limite = rateLimit.consumir(`cadastro:${ip ?? "sem-ip"}:${corpo.email}`, CADASTRO_LIMITE);
  if (!limite.permitido) {
    throw errors.rateLimitExcedido({
      retryAfterSegundos: Math.max(1, Math.ceil((limite.redefinirEm.getTime() - Date.now()) / 1000)),
    });
  }

  const resultado = await cadastrar({ ...corpo, ipHash: hashIp(ip) }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 201, context.requestId);
});
