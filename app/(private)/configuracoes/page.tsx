import type { Metadata } from "next";

import { ConfiguracoesView } from "./configuracoes-view";

export const metadata: Metadata = { title: "Configurações — Investment Control" };

export const dynamic = "force-dynamic";

/**
 * `/configuracoes` — área autenticada (UI_SPEC §14.1, RN-049-4).
 *
 * A proteção de sessão é do middleware (`ROTAS_PRIVADAS`); a tela só monta a
 * view cliente depois que a navegação passa pelo layout privado.
 */
export default function ConfiguracoesPage() {
  return <ConfiguracoesView />;
}
