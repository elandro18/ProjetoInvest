import type { Metadata } from "next";

import { CarteiraView } from "./carteira-view";

export const metadata: Metadata = { title: "Carteira — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/carteira` — área autenticada (UI_SPEC §5, RN-020-3).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a tela só monta a
 * view cliente depois que a navegação passa pelo layout privado.
 */
export default function CarteiraPage() {
  return <CarteiraView />;
}
