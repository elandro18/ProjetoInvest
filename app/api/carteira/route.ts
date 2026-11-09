import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosCarteira } from "@/src/infra/container/carteira";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { isErr } from "@/src/lib/result";
import { apresentarCarteira } from "@/src/modules/carteira/apresentacao";
import { obterCarteira } from "@/src/modules/carteira/obter-carteira";

/**
 * `GET /api/carteira` — autenticado (API_CONTRACTS.md §5.1; RN-020, RN-023,
 * RN-089, RN-091).
 *
 * O `usuarioId` vem exclusivamente da sessão (`requireUsuario`), nunca de
 * query ou corpo. Sem cotação na Fase 1, `cotacoes.statusDado` é
 * `INDISPONIVEL` e `dataReferencia` é `null`; FII entra pelo custo com
 * `valorIndisponivel: true`.
 */

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();

  const resultado = await obterCarteira(
    { usuarioId: usuario.usuarioId },
    servicosCarteira(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarCarteira(resultado.value), 200, context.requestId);
});
