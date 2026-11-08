/**
 * Destino de retorno do login (SECURITY.md §6 — sem open redirect).
 *
 * Só caminhos internos são aceitos. `//host` e `/\host` são rejeitados porque
 * o navegador os interpreta como URL absoluta. A normalização via `URL` ainda
 * remove truques de `..` e caracteres codificados.
 */
export function sanitizeCallbackUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const valor = raw.trim();
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) {
    return null;
  }

  try {
    const base = "http://interno.local";
    const url = new URL(valor, base);
    if (url.origin !== base) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
