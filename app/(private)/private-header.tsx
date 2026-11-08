"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import { apiRequest } from "@/src/lib/api-client";

export interface PrivateHeaderProps {
  readonly nome: string;
}

/**
 * Cabeçalho da área autenticada (UI_SPEC §2.1).
 *
 * Encerra a sessão no servidor e só então navega para o login. Em 360 px os
 * itens quebram em duas linhas, sem overflow horizontal.
 */
export function PrivateHeader({ nome }: PrivateHeaderProps) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function sair() {
    setErro(null);
    setSaindo(true);
    try {
      const resultado = await apiRequest<undefined>("/api/auth/logout", { method: "POST" });
      if (!resultado.ok) {
        setErro("Não foi possível sair. Tente novamente.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } finally {
      setSaindo(false);
    }
  }

  return (
    <header className="border-b border-neutral-200 bg-neutral-0">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/conta" className="flex items-center gap-2 rounded-lg text-neutral-900">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-neutral-0"
          >
            IC
          </span>
          <span className="text-base font-semibold">Investment Control</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <span className="max-w-40 truncate text-sm text-neutral-700" title={nome}>
            {nome}
          </span>
          <Link
            href="/conta"
            className="rounded-lg px-2 py-1 text-sm font-medium text-info hover:underline"
            aria-current="page"
          >
            Conta
          </Link>
          <Button variant="secondary" onClick={sair} carregando={saindo} className="px-3 py-1.5">
            {saindo ? "Saindo…" : "Sair"}
          </Button>
        </div>
      </div>
      {erro === null ? null : (
        <p role="alert" className="mx-auto w-full max-w-3xl px-4 pb-3 text-sm text-negative sm:px-6">
          {erro}
        </p>
      )}
    </header>
  );
}
