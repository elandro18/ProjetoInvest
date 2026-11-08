import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";
import { autorizarCredenciais } from "./credentials";

/**
 * Auth.js com provider de credenciais (ADR-003, ARCHITECTURE.md §7).
 *
 * Só este arquivo importa Prisma/Argon2: ele é usado por Route Handlers e
 * Server Components (runtime Node). O middleware importa exclusivamente
 * `auth.config.ts`.
 */

const provedorCredenciais = Credentials({
  id: "credentials",
  name: "Credenciais",
  credentials: {
    email: { label: "E-mail", type: "email" },
    senha: { label: "Senha", type: "password" },
  },
  authorize: autorizarCredenciais,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [provedorCredenciais],
});
