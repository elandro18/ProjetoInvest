"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly carregando?: boolean;
  readonly larguraTotal?: boolean;
  readonly children: ReactNode;
}

const ESTILOS: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 text-neutral-0 hover:bg-neutral-700",
  secondary: "border border-neutral-200 bg-neutral-0 text-neutral-900 hover:bg-neutral-50",
  danger: "bg-negative text-neutral-0 hover:opacity-90",
  ghost: "text-neutral-700 hover:bg-neutral-100",
};

/**
 * Botão do design system (UI_SPEC §15).
 *
 * `aria-busy` acompanha o envio e o botão fica desabilitado enquanto a ação
 * está em curso, sem esconder o rótulo (UI_SPEC §16).
 */
export function Button({
  variant = "primary",
  carregando = false,
  larguraTotal = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || carregando}
      aria-busy={carregando || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        ESTILOS[variant],
        larguraTotal ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {carregando ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
