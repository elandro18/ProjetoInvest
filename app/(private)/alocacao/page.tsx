import type { Metadata } from "next";

import { AlocacaoView } from "./alocacao-view";

export const metadata: Metadata = { title: "Alocação — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/alocacao` — área autenticada (UI_SPEC §9, RN-021-4).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a tela só monta a
 * view cliente depois que a navegação passa pelo layout privado.
 */
export default function AlocacaoPage() {
  return <AlocacaoView />;
}
