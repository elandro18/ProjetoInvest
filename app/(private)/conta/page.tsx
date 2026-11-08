import type { Metadata } from "next";

import { ContaView } from "./conta-view";

export const metadata: Metadata = { title: "Conta — Investment Control" };

export const dynamic = "force-dynamic";

export default function ContaPage() {
  return <ContaView />;
}
