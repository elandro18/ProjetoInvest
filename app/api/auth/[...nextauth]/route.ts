import { handlers } from "@/src/infra/auth/auth";

/**
 * Endpoints internos do Auth.js (csrf, callback, session, signout…).
 *
 * As rotas públicas de conta (`/api/auth/login`, `/logout`, `/sessao`,
 * `/cadastro`, …) são arquivos estáticos e têm precedência sobre o catch-all.
 */

export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
