import type { ReactNode } from "react";

/**
 * Layout das telas públicas de conta (UI_SPEC §3).
 *
 * Coluna única centralizada, cartão com marca e largura máxima de 448 px —
 * utilizável em 360 px sem overflow horizontal (UI_SPEC §19).
 */
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <a
        href="/login"
        className="mb-6 flex items-center gap-2 rounded-lg text-neutral-900"
        aria-label="Investment Control — ir para o login"
      >
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-neutral-0"
        >
          IC
        </span>
        <span className="text-lg font-semibold">Investment Control</span>
      </a>
      <main
        id="conteudo"
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-neutral-0 p-6 shadow-sm sm:p-8"
      >
        {children}
      </main>
      <p className="mt-6 max-w-md text-center text-xs text-neutral-500">
        Consolidação de patrimônio e apoio à decisão de aporte. Projeção não é garantia de
        rentabilidade.
      </p>
    </div>
  );
}
