import { z } from "zod";

import { isErr } from "@/src/lib/result";
import { signOut } from "@/src/infra/auth/auth";
import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosConta } from "@/src/infra/container/conta";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { encerrarConta } from "@/src/modules/conta/encerramento";

/**
 * `DELETE /api/conta` — autenticado (API_CONTRACTS.md §2.9, RN-085, RN-088).
 *
 * O `usuarioId` vem exclusivamente da sessão (`requireUsuario`), nunca do
 * corpo. A senha atual é a confirmação obrigatória de uma operação
 * irreversível. Concluído o encerramento, a sessão é descartada no mesmo
 * request para o navegador não reter um cookie de conta anonimizada.
 */

export const dynamic = "force-dynamic";

const encerrarContaSchema = z.object({
  senha: z.string().min(1).max(200),
});

export const DELETE = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const { senha } = await parseJsonBody(request, encerrarContaSchema);

  const resultado = await encerrarConta({ usuarioId: usuario.usuarioId, senha }, servicosConta());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  await signOut({ redirect: false });

  return jsonResponse(resultado.value, 200, context.requestId);
});
