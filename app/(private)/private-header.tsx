"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ativosAtivo = pathname === "/ativos" || pathname.startsWith("/ativos/");
  const movimentacoesAtivo =
    pathname === "/movimentacoes" || pathname.startsWith("/movimentacoes/");
  const rendaFixaAtivo =
    pathname === "/renda-fixa" || pathname.startsWith("/renda-fixa/");
  const contaAtivo = pathname === "/conta" || pathname.startsWith("/conta/");

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
          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-3">
            <Link
              href="/movimentacoes"
              aria-current={movimentacoesAtivo ? "page" : undefined}
              className={[
                "rounded-lg px-2 py-1 text-sm font-medium",
                movimentacoesAtivo
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-info hover:underline",
              ].join(" ")}
            >
              Movimentações
            </Link>
            <Link
              href="/ativos"
              aria-current={ativosAtivo ? "page" : undefined}
              className={[
                "rounded-lg px-2 py-1 text-sm font-medium",
                ativosAtivo
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-info hover:underline",
              ].join(" ")}
            >
              Ativos
            </Link>
            <Link
              href="/renda-fixa"
              aria-current={rendaFixaAtivo ? "page" : undefined}
              className={[
                "rounded-lg px-2 py-1 text-sm font-medium",
                rendaFixaAtivo
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-info hover:underline",
              ].join(" ")}
            >
              Renda fixa
            </Link>
            <Link
              href="/conta"
              aria-current={contaAtivo ? "page" : undefined}
              className={[
                "rounded-lg px-2 py-1 text-sm font-medium",
                contaAtivo
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-info hover:underline",
              ].join(" ")}
            >
              Conta
            </Link>
            <Button variant="secondary" onClick={sair} carregando={saindo} className="px-3 py-1.5">
              {saindo ? "Saindo…" : "Sair"}
            </Button>
          </nav>
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
