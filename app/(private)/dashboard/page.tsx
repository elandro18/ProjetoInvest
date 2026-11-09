import type { Metadata } from "next";

import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/dashboard` — tela inicial da área autenticada (UI_SPEC §4, RN-061-5).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a view cliente
 * consulta `GET /api/dashboard` e trata cada bloco de forma independente.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
