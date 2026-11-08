import type { NextAuthConfig } from "next-auth";

/**
 * Configuração compartilhada do Auth.js (ADR-003, ARCHITECTURE.md §7).
 *
 * Este arquivo é **edge-safe**: roda no middleware sem tocar em Prisma,
 * Argon2 ou qualquer API de Node. Os providers e o `authorize` que acessam o
 * banco vivem em `auth.ts`, importado apenas por código de runtime Node.
 */

/** Página para onde o middleware manda quem não tem sessão (RN-085). */
export const PAGINA_LOGIN = "/login";

/** Expiração absoluta da sessão: 8 h (SECURITY.md §4). */
export const SESSAO_MAX_AGE_SEGUNDOS = 8 * 60 * 60;

/** Renovação deslizante por atividade, no máximo uma vez por hora. */
export const SESSAO_UPDATE_AGE_SEGUNDOS = 60 * 60;

export const authConfig = {
  // Preenchido em `auth.ts`; o middleware só decodifica o JWT existente.
  providers: [],
  pages: {
    signIn: PAGINA_LOGIN,
    error: PAGINA_LOGIN,
  },
  session: {
    strategy: "jwt",
    maxAge: SESSAO_MAX_AGE_SEGUNDOS,
    updateAge: SESSAO_UPDATE_AGE_SEGUNDOS,
  },
  // Necessário atrás de proxy (Vercel) para confiar no host encaminhado.
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.nome = user.nome;
        token.statusConta = user.statusConta;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user !== undefined) {
        session.user.id = token.id;
        session.user.nome = token.nome;
        session.user.statusConta = token.statusConta;
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
