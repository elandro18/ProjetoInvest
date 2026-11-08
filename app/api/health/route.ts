import { jsonResponse } from "@/src/infra/http/response";
import { withRoute } from "@/src/infra/http/handler";

/**
 * `GET /api/health` — público (API_CONTRACTS.md §13, RN-001-5).
 *
 * Nesta task o healthcheck só prova a integração do núcleo transversal
 * (requestId + log estruturado + envelope). A checagem real de banco entra
 * na RN-001-5; até lá a resposta é estática e não expõe versão nem conexão.
 */
export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  return jsonResponse({ status: "ok", banco: "ok" }, 200, context.requestId);
});
