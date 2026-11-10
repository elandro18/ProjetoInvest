import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosRisco } from "@/src/infra/container/risco";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { isErr } from "@/src/lib/result";
import { apresentarConcentracao } from "@/src/modules/risco/apresentacao";
import { obterConcentracao } from "@/src/modules/risco/obter-concentracao";

/**
 * `GET /api/risco/concentracao` — autenticado (API_CONTRACTS.md §12.1;
 * RN-049-3, RN-089, RN-091). O `usuarioId` vem exclusivamente da sessão.
 */

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();
  const servicos = servicosRisco();

  const resultado = await obterConcentracao(
    { usuarioId: usuario.usuarioId },
    {
      valorCarteira: servicos.valorCarteira,
      repositorio: servicos.repositorio,
      limites: servicos.limites,
    },
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarConcentracao(resultado.value), 200, context.requestId);
});
