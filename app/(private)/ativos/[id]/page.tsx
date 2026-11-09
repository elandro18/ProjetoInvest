import type { Metadata } from "next";

import { AtivoFichaView } from "./ativo-ficha-view";

export const metadata: Metadata = { title: "Ficha do ativo — Investment Control" };

export const dynamic = "force-dynamic";

interface AtivoPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function AtivoPage({ params }: AtivoPageProps) {
  const { id } = await params;
  return <AtivoFichaView key={id} ativoId={id} />;
}
