import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosDashboard } from "@/src/infra/container/dashboard";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { isErr } from "@/src/lib/result";
import { obterDashboard } from "@/src/modules/dashboard/obter-dashboard";

/**
 * `GET /api/dashboard` — autenticado (API_CONTRACTS.md §5.3; RN-061, RN-062,
 * RN-063 e RN-073).
 *
 * O `usuarioId` vem exclusivamente da sessão (`requireUsuario`), nunca de
 * query ou corpo. Cada bloco é independente: uma falha parcial vira item em
 * `erros[]` e a resposta continua 200; 503 só quando nenhum bloco foi
 * produzido.
 */

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();

  const resultado = await obterDashboard(
    { usuarioId: usuario.usuarioId },
    servicosDashboard(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(resultado.value, 200, context.requestId);
});
