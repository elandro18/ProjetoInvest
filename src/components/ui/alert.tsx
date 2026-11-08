"use client";

import type { ReactNode } from "react";

export type AlertTone = "error" | "success" | "warning" | "info";

export interface AlertProps {
  readonly tone?: AlertTone;
  readonly title?: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

const ESTILOS: Record<AlertTone, string> = {
  error: "border-negative/40 bg-negative/5",
  success: "border-positive/40 bg-positive/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-info/40 bg-info/5",
};

const TITULO_COR: Record<AlertTone, string> = {
  error: "text-negative",
  success: "text-positive",
  warning: "text-warning",
  info: "text-info",
};

/**
 * Alerta de estado (UI_SPEC §17, §20).
 *
 * Erro é anunciado como `alert`; sucesso/informação como `status`. O
 * significado está no texto e no título — a cor é reforço, nunca o único
 * portador (UI_SPEC §18).
 */
export function Alert({ tone = "info", title, children, action }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={["rounded-lg border-l-4 px-4 py-3 text-sm text-neutral-900", ESTILOS[tone]].join(" ")}
    >
      {title === undefined ? null : (
        <p className={["mb-1 font-semibold", TITULO_COR[tone]].join(" ")}>{title}</p>
      )}
      <div className="space-y-2">{children}</div>
      {action === undefined ? null : <div className="mt-2">{action}</div>}
    </div>
  );
}
