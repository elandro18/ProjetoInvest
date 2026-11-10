import type { Metadata } from "next";

import { AportesView } from "./aportes-view";

export const metadata: Metadata = { title: "Aportes — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/aportes` — área autenticada (UI_SPEC §10, RN-025-6).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a tela só monta a
 * view cliente depois que a navegação passa pelo layout privado.
 */
export default function AportesPage() {
  return <AportesView />;
}
