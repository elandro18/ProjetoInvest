"use client";

import type { ReactNode } from "react";

import { Button } from "./button";

export interface ErrorStateProps {
  readonly title?: string;
  readonly message: string;
  readonly traceId?: string | null;
  readonly onRetry?: (() => void) | undefined;
  readonly retrying?: boolean;
  readonly action?: ReactNode;
}

/**
 * Erro de carregamento com retry (UI_SPEC §15, §17).
 *
 * `traceId` aparece discretamente para suporte; a ação primária é sempre
 * explícita em texto.
 */
export function ErrorState({
  title = "Não foi possível carregar",
  message,
  traceId,
  onRetry,
  retrying = false,
  action,
}: ErrorStateProps) {
  return (
    <section role="alert" className="rounded-xl border border-negative/40 bg-negative/5 p-6">
      <h2 className="text-base font-semibold text-negative">{title}</h2>
      <p className="mt-1 text-sm text-neutral-900">{message}</p>
      {traceId === undefined || traceId === null || traceId === "" ? null : (
        <p className="mt-2 text-xs text-neutral-500">
          Referência: <span className="font-mono">{traceId}</span>
        </p>
      )}
      {onRetry === undefined && action === undefined ? null : (
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry === undefined ? null : (
            <Button variant="secondary" onClick={onRetry} carregando={retrying}>
              Tentar novamente
            </Button>
          )}
          {action}
        </div>
      )}
    </section>
  );
}
