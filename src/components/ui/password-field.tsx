"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly id?: string | undefined;
}

/**
 * Campo de senha com alternância de visibilidade (UI_SPEC §16, §18).
 *
 * O botão de mostrar/ocultar é acionável por teclado, tem nome acessível e não
 * substitui o rótulo do campo. Nenhum valor é exposto em `aria-*`.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, hint, id, className = "", disabled, ...rest },
  ref,
) {
  const gerado = useId();
  const fieldId = id ?? gerado;
  const erroId = `${fieldId}-erro`;
  const dicaId = `${fieldId}-dica`;
  const [visivel, setVisivel] = useState(false);
  const describedBy =
    [hint === undefined ? null : dicaId, error === undefined ? null : erroId]
      .filter((valor): valor is string => valor !== null)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          id={fieldId}
          type={visivel ? "text" : "password"}
          disabled={disabled}
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={describedBy}
          className={[
            "w-full rounded-lg border bg-neutral-0 px-3 py-2 pr-20 text-sm text-neutral-900",
            "placeholder:text-neutral-500",
            "disabled:cursor-not-allowed disabled:bg-neutral-100",
            error === undefined ? "border-neutral-200" : "border-negative",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          disabled={disabled}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-xs font-medium text-info hover:underline disabled:cursor-not-allowed"
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {hint === undefined ? null : (
        <p id={dicaId} className="text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={erroId} className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
});
