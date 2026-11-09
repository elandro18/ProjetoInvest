import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { listarReferenciaAtivos } from "@/src/infra/db/referencia-ativos";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";

/**
 * `GET /api/referencia/ativos` — autenticado (API_CONTRACTS.md §3.5; RN-010-7).
 *
 * Catálogo de classes e segmentos ativos para os selects do formulário de
 * ativo e, depois, das metas de alocação (RN-021). A leitura é feita direto
 * via infraestrutura: é dado de referência, sem regra de domínio própria — a
 * sessão apenas garante que o catálogo não fique público.
 */

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  await requireUsuario();

  const referencia = await listarReferenciaAtivos();

  return jsonResponse(referencia, 200, context.requestId);
});
