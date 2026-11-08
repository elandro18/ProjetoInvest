import { z } from "zod";

import { isErr } from "@/src/lib/result";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { redefinirSenha } from "@/src/modules/conta/reset";

/**
 * `POST /api/auth/redefinir-senha` — público (API_CONTRACTS.md §2.5, RN-085).
 *
 * A forma do corpo é validada na borda; a força da senha é regra de domínio
 * (`AUTH_SENHA_FRACA` 422), para não divergir do cadastro. O token é opaco e
 * de uso único — o hash é procurado no banco e a troca derruba as sessões.
 */

export const dynamic = "force-dynamic";

const redefinirSenhaSchema = z.object({
  token: z.string().trim().min(1),
  novaSenha: z.string(),
});

export const POST = withRoute(async (request, context) => {
  const { token, novaSenha } = await parseJsonBody(request, redefinirSenhaSchema);

  const resultado = await redefinirSenha({ token, novaSenha }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 200, context.requestId);
});
