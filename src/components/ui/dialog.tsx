"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Largura do painel; `lg` é para conteúdo de leitura longa (ex.: snapshot). */
export type DialogSize = "md" | "lg";

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly initialFocusId?: string | undefined;
  readonly size?: DialogSize;
}

const LARGURA: Record<DialogSize, string> = {
  md: "max-w-md",
  lg: "max-w-3xl",
};

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal acessível (UI_SPEC §15, §18).
 *
 * - `role="dialog"` + `aria-modal` + título associado;
 * - foco inicial definido (`initialFocusId` ou primeiro focável);
 * - Tab/Shift+Tab presos dentro do painel;
 * - ESC cancela e o foco volta ao elemento que abriu.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  initialFocusId,
  size = "md",
}: DialogProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const painel = painelRef.current;
    const focarInicial = () => {
      const porId =
        initialFocusId === undefined ? null : document.getElementById(initialFocusId);
      if (porId !== null && painel !== null && painel.contains(porId)) {
        porId.focus();
        return;
      }
      painel?.querySelector<HTMLElement>(SELETOR_FOCAVEL)?.focus();
    };
    focarInicial();

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focaveis = painel?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL);
      if (focaveis === undefined || focaveis.length === 0) {
        event.preventDefault();
        painel?.focus();
        return;
      }

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;

      if (event.shiftKey && ativo === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && ativo === ultimo) {
        event.preventDefault();
        primeiro.focus();
      } else if (painel !== null && !painel.contains(ativo)) {
        event.preventDefault();
        primeiro.focus();
      }
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      anterior?.focus();
    };
  }, [open, initialFocusId]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/50 p-4 sm:items-center">
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={[
          "max-h-[85dvh] w-full overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-0 p-6 shadow-lg",
          LARGURA[size],
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Fechar"
            className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-xl leading-none text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            ×
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm text-neutral-700">{children}</div>
        {footer === undefined ? null : <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
