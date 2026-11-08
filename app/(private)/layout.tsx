import type { ReactNode } from "react";

import { auth } from "@/src/infra/auth/auth";
import { PrivateHeader } from "./private-header";

/**
 * Layout da área autenticada (UI_SPEC §2.1).
 *
 * O middleware já garante a sessão; aqui a sessão é lida apenas para exibir o
 * nome do titular no cabeçalho. O conteúdo é uma coluna única centrada — a
 * navegação de negócio entra nas features seguintes.
 */
export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: Readonly<{ children: ReactNode }>) {
  const sessao = await auth();
  const nome = sessao?.user?.nome ?? "Titular";

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <a
        href="#conteudo"
        className="sr-only rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-0 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Ir para o conteúdo
      </a>
      <PrivateHeader nome={nome} />
      <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-neutral-200 px-4 py-4 text-center text-xs text-neutral-500">
        Investment Control
      </footer>
    </div>
  );
}
