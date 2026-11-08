import { signOut } from "@/src/infra/auth/auth";
import { withRoute } from "@/src/infra/http/handler";
import { noContentResponse } from "@/src/infra/http/response";

/**
 * `POST /api/auth/logout` — autenticado (API_CONTRACTS.md §2.7, RN-085).
 *
 * O Auth.js limpa o cookie de sessão; a resposta não tem corpo (204). Logout
 * sem sessão também é 204 — não há estado a revelar.
 */

export const dynamic = "force-dynamic";

export const POST = withRoute(async (_request, context) => {
  await signOut({ redirect: false });

  return noContentResponse(context.requestId);
});
