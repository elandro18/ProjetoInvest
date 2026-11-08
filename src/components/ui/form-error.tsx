"use client";

import type { ReactNode } from "react";

export interface FormErrorProps {
  readonly id?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Erro geral do formulário (não vinculado a um campo).
 *
 * `role="alert"` garante anúncio imediato; a mensagem fica acima do botão de
 * envio para o titular não precisar procurar o motivo.
 */
export function FormError({ id, children }: FormErrorProps) {
  return (
    <p id={id} role="alert" className="text-sm font-medium text-negative">
      {children}
    </p>
  );
}
