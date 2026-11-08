import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { ERROR_CATALOG } from "./src/lib/errors";
import { authConfig, PAGINA_LOGIN } from "./src/infra/auth/auth.config";
import { decidirAcesso } from "./src/infra/auth/middleware-rules";

/**
 * Middleware de proteção (RN-067, RN-085; ARCHITECTURE.md §7).
 *
 * Importa **apenas** `auth.config.ts` — Edge-safe, sem Prisma/Argon2. A
 * decisão de acesso é delegada a `middleware-rules.ts` (função pura): API sem
 * sessão recebe 401; página privada redireciona para `/login` com
 * `callbackUrl` restrito ao caminho interno.
 */

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const decisao = decidirAcesso({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    autenticado: request.auth?.user !== undefined && request.auth?.user !== null,
  });

  if (decisao.tipo === "liberar") {
    return NextResponse.next();
  }

  if (decisao.tipo === "naoAutenticado") {
    const entrada = ERROR_CATALOG.NAO_AUTENTICADO;
    return NextResponse.json(
      { error: { code: "NAO_AUTENTICADO", message: entrada.message } },
      { status: entrada.status },
    );
  }

  const login = request.nextUrl.clone();
  login.pathname = PAGINA_LOGIN;
  login.search = "";
  login.searchParams.set("callbackUrl", decisao.callbackUrl);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/carteira/:path*",
    "/ativos/:path*",
    "/movimentacoes/:path*",
    "/renda-fixa/:path*",
    "/alocacao/:path*",
    "/aportes/:path*",
    "/pesquisa/:path*",
    "/avaliacoes/:path*",
    "/watchlist/:path*",
    "/projecoes/:path*",
    "/configuracoes/:path*",
    "/conta/:path*",
    "/api/:path*",
  ],
};
