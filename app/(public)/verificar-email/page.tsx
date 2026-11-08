import type { Metadata } from "next";

import { VerificarEmailConteudo } from "./verificar-email-conteudo";

export const metadata: Metadata = { title: "Verificar e-mail — Investment Control" };

export const dynamic = "force-dynamic";

interface VerificarEmailPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VerificarEmailPage({ searchParams }: VerificarEmailPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Verificar e-mail</h1>
        <p className="text-sm text-neutral-700">Estamos confirmando o endereço da sua conta.</p>
      </div>
      <VerificarEmailConteudo token={token} />
    </div>
  );
}
