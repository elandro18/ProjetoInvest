import type { Metadata } from "next";

import { RedefinirSenhaConteudo } from "./redefinir-senha-conteudo";

export const metadata: Metadata = { title: "Redefinir senha — Investment Control" };

export const dynamic = "force-dynamic";

interface RedefinirSenhaPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RedefinirSenhaPage({ searchParams }: RedefinirSenhaPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Redefinir senha</h1>
        <p className="text-sm text-neutral-700">Escolha uma nova senha para sua conta.</p>
      </div>
      <RedefinirSenhaConteudo token={token} />
    </div>
  );
}
