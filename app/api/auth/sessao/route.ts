import { AppError, errors } from "@/src/lib/errors";
import { auth } from "@/src/infra/auth/auth";
import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";

/**
 * `GET /api/auth/sessao` — autenticado (API_CONTRACTS.md §2.8, RN-085).
 *
 * Toda ausência de sessão válida vira `AUTH_SESSAO_EXPIRADA` (401), inclusive
 * o caso em que a conta deixou de estar ativa ou a `sessionVersion` mudou.
 */

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, context) => {
  const sessao = await auth();
  if (sessao === null) {
    throw errors.authSessaoExpirada();
  }

  let usuario;
  try {
    usuario = await requireUsuario();
  } catch (erro) {
    if (AppError.isAppError(erro) && erro.code === "NAO_AUTENTICADO") {
      throw errors.authSessaoExpirada();
    }
    throw erro;
  }

  return jsonResponse(
    {
      usuario: {
        id: usuario.usuarioId,
        nome: usuario.nome,
        email: usuario.email,
        statusConta: "ATIVA",
      },
      expiraEm: sessao.expires,
    },
    200,
    context.requestId,
  );
});
