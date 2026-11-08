"use client";

import { useId, type ChangeEvent, type ReactNode } from "react";

export interface CheckboxProps {
  readonly label: ReactNode;
  readonly checked: boolean;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
}

/**
 * Checkbox com rótulo rico (links para Termos/Privacidade — UI_SPEC §3.2).
 *
 * Erro associado por `aria-describedby` e `aria-invalid`. O link dentro do
 * rótulo interrompe a propagação para não alternar a caixa ao navegar.
 */
export function Checkbox({ label, checked, onChange, error, disabled, id }: CheckboxProps) {
  const gerado = useId();
  const fieldId = id ?? gerado;
  const erroId = `${fieldId}-erro`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2.5">
        <input
          id={fieldId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={error === undefined ? undefined : erroId}
          className="mt-0.5 size-4 shrink-0 rounded border-neutral-500 accent-neutral-900"
        />
        <label htmlFor={fieldId} className="text-sm leading-6 text-neutral-700">
          {label}
        </label>
      </div>
      {error === undefined ? null : (
        <p id={erroId} className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
