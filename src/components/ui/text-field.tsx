"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly id?: string | undefined;
}

/**
 * Campo de texto acessível (UI_SPEC §16, §18).
 *
 * `label` sempre associado ao input; erro e dica entram em `aria-describedby`
 * e `aria-invalid` marca o estado. O erro é texto — nunca apenas cor.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className = "", ...rest },
  ref,
) {
  const gerado = useId();
  const fieldId = id ?? gerado;
  const erroId = `${fieldId}-erro`;
  const dicaId = `${fieldId}-dica`;
  const describedBy =
    [hint === undefined ? null : dicaId, error === undefined ? null : erroId]
      .filter((valor): valor is string => valor !== null)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={fieldId}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "w-full rounded-lg border bg-neutral-0 px-3 py-2 text-sm text-neutral-900",
          "placeholder:text-neutral-500",
          "disabled:cursor-not-allowed disabled:bg-neutral-100",
          error === undefined ? "border-neutral-200" : "border-negative",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
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
