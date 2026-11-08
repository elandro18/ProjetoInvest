/**
 * Regras puras de proteção de rota (RN-067, RN-085).
 *
 * Ficam separadas do `middleware.ts` para serem testáveis sem Edge Runtime e
 * para o middleware continuar sendo um adaptador fino de `NextResponse`.
 *
 * Rotas de API respondem 401; páginas privadas redirecionam para o login
 * preservando o destino interno (SECURITY.md §6 — sem open redirect).
 */

/** Áreas privadas da aplicação (ARCHITECTURE.md §7). */
export const ROTAS_PRIVADAS: readonly string[] = [
  "/dashboard",
  "/carteira",
  "/ativos",
  "/movimentacoes",
  "/renda-fixa",
  "/alocacao",
  "/aportes",
  "/pesquisa",
  "/avaliacoes",
  "/watchlist",
  "/projecoes",
  "/configuracoes",
  "/conta",
];

/** Prefixos de API que dispensam sessão. */
export const APIS_PUBLICAS: readonly string[] = ["/api/auth", "/api/health"];

export type DecisaoAcesso =
  | { readonly tipo: "liberar" }
  | { readonly tipo: "naoAutenticado" }
  | { readonly tipo: "redirecionar"; readonly callbackUrl: string };

export function ehRotaPrivada(pathname: string): boolean {
  return ROTAS_PRIVADAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

export function ehApiPublica(pathname: string): boolean {
  return APIS_PUBLICAS.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}

export function decidirAcesso(input: {
  readonly pathname: string;
  readonly search: string;
  readonly autenticado: boolean;
}): DecisaoAcesso {
  if (input.autenticado) {
    return { tipo: "liberar" };
  }

  if (input.pathname.startsWith("/api/")) {
    return ehApiPublica(input.pathname) ? { tipo: "liberar" } : { tipo: "naoAutenticado" };
  }

  if (!ehRotaPrivada(input.pathname)) {
    return { tipo: "liberar" };
  }

  return { tipo: "redirecionar", callbackUrl: `${input.pathname}${input.search}` };
}
