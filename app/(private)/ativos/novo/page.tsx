import type { Metadata } from "next";

import { NovoAtivoView } from "./novo-ativo-view";

export const metadata: Metadata = { title: "Novo ativo — Investment Control" };

export const dynamic = "force-dynamic";

export default function NovoAtivoPage() {
  return <NovoAtivoView />;
}
