import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAlocacao } from "@/src/infra/container/alocacao";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { isErr } from "@/src/lib/result";
import { apresentarDesvios } from "@/src/modules/alocacao/apresentacao";
import { calcularDesvios } from "@/src/modules/alocacao/calcular-desvios";

/**
 * `GET /api/alocacao/desvios` — autenticado (API_CONTRACTS.md §7.3; RN-021-3).
 *
 * A base de cálculo é sempre o patrimônio total, inclusive para segmentos
 * (RN-089). O valor agregado vem do port `ValorCarteira` — reutilizável pela
 * RN-020 — e não de consulta Prisma direta na borda.
 */

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();

  const resultado = await calcularDesvios(
    { usuarioId: usuario.usuarioId },
    servicosAlocacao(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarDesvios(resultado.value), 200, context.requestId);
});
