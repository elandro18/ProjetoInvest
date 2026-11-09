import type { Metadata } from "next";

import { AtivosLista } from "./ativos-lista";

export const metadata: Metadata = { title: "Ativos — Investment Control" };

export const dynamic = "force-dynamic";

interface AtivosPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AtivosPage({ searchParams }: AtivosPageProps) {
  const params = await searchParams;
  const criado = typeof params.criado === "string" ? params.criado : null;

  return <AtivosLista feedback={criado} />;
}
