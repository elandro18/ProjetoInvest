import type { Metadata } from "next";

import { MovimentacoesView } from "./movimentacoes-view";

export const metadata: Metadata = { title: "Movimentações — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/movimentacoes` — área autenticada (UI_SPEC §7, RN-014-5).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a tela só monta a
 * view cliente depois que a navegação passa pelo layout privado.
 */
export default function MovimentacoesPage() {
  return <MovimentacoesView />;
}
