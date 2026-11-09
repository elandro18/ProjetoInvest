import type { Metadata } from "next";

import { RendaFixaView } from "./renda-fixa-view";

export const metadata: Metadata = { title: "Renda fixa — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/renda-fixa` — área autenticada (UI_SPEC §8, RN-057-4).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a tela só monta a
 * view cliente depois que a navegação passa pelo layout privado.
 */
export default function RendaFixaPage() {
  return <RendaFixaView />;
}
