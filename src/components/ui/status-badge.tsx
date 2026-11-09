import type { ReactNode } from "react";

export type StatusBadgeTone = "success" | "neutral" | "warning" | "info" | "error";

export interface StatusBadgeProps {
  readonly tone?: StatusBadgeTone;
  readonly children: ReactNode;
}

const ESTILOS: Record<StatusBadgeTone, string> = {
  success: "border-positive/40 bg-positive/5 text-positive",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-700",
  warning: "border-warning/40 bg-warning/5 text-warning",
  info: "border-info/40 bg-info/5 text-info",
  error: "border-negative/40 bg-negative/5 text-negative",
};

/**
 * Badge de situação (UI_SPEC §15).
 *
 * O texto é obrigatório: a cor é reforço e nunca o único portador do
 * significado (UI_SPEC §18).
 */
export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        ESTILOS[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
