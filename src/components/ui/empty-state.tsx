import type { ReactNode } from "react";

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
}

/**
 * Ausência de dados com explicação e ação (UI_SPEC §15, §17).
 *
 * Diferencia "vazio" de "indisponível" pelo texto — a moldura é a mesma para
 * manter a previsibilidade visual entre telas.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-xl border border-dashed border-neutral-200 bg-neutral-0 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {description === undefined ? null : (
        <div className="mx-auto mt-2 max-w-md text-sm text-neutral-700">{description}</div>
      )}
      {action === undefined ? null : (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </section>
  );
}
