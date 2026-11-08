import { z } from "zod";

import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { signIn } from "@/src/infra/auth/auth";
import { ipDaRequisicao } from "@/src/infra/auth/ip-hash";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { rateLimit } from "@/src/infra/rate-limit/memory";
import { autenticar } from "@/src/modules/conta/login";

/**
 * `POST /api/auth/login` — público (API_CONTRACTS.md §2.6, RN-085).
 *
 * A borda aplica o rate limit de 5/15 min por IP + e-mail e delega as regras
 * de credencial/status ao caso de uso. Só depois de tudo validado chama
 * `signIn("credentials")`, que emite o cookie de sessão (httpOnly/lax).
 *
 * A resposta nunca devolve `sessionVersion` nem hash — DTO explícito.
 */

export const dynamic = "force-dynamic";

const LOGIN_LIMITE = { limite: 5, janelaMs: 15 * 60 * 1000 } as const;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
  senha: z.string().min(1).max(200),
});

export const POST = withRoute(async (request, context) => {
  const { email, senha } = await parseJsonBody(request, loginSchema);
  const ip = ipDaRequisicao(request.headers);

  const limite = rateLimit.consumir(`login:${ip ?? "sem-ip"}:${email}`, LOGIN_LIMITE);
  if (!limite.permitido) {
    throw errors.rateLimitExcedido({
      retryAfterSegundos: Math.max(1, Math.ceil((limite.redefinirEm.getTime() - Date.now()) / 1000)),
    });
  }

  const resultado = await autenticar({ email, senha }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  const destino = await signIn("credentials", { email, senha, redirect: false });
  if (typeof destino === "string" && destino.includes("error=")) {
    // Corrida entre a validação acima e o authorize (ex.: conta mudou de estado).
    throw errors.authCredenciaisInvalidas();
  }

  const { usuario } = resultado.value;

  return jsonResponse(
    {
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        statusConta: usuario.statusConta,
      },
    },
    200,
    context.requestId,
  );
});
