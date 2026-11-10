import type { Metadata } from "next";

import { HistoricoView } from "./historico-view";

export const metadata: Metadata = { title: "Histórico de sugestões — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/aportes/historico` — área autenticada (UI_SPEC §10.1, RN-052-2).
 *
 * A proteção de sessão é do middleware (`/aportes/:path*`); a tela é somente
 * leitura e monta a view cliente depois que a navegação passa pelo layout
 * privado.
 */
export default function HistoricoAportesPage() {
  return <HistoricoView />;
}
