"use client";

import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly id?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Select acessível (UI_SPEC §16, §18).
 *
 * Mesmo contrato do `TextField`: `label` sempre associado, erro e dica em
 * `aria-describedby`, `aria-invalid` no estado inválido.
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, id, className = "", children, ...rest },
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
      <select
        {...rest}
        ref={ref}
        id={fieldId}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "w-full rounded-lg border bg-neutral-0 px-3 py-2 text-sm text-neutral-900",
          "disabled:cursor-not-allowed disabled:bg-neutral-100",
          error === undefined ? "border-neutral-200" : "border-negative",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </select>
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
