"use client";

import { avaliarForcaSenha, type ForcaPontuacao } from "@/src/lib/password-strength";

export interface PasswordStrengthProps {
  readonly senha: string;
}

const COR_SEGMENTO: Record<ForcaPontuacao, string> = {
  0: "bg-neutral-200",
  1: "bg-negative",
  2: "bg-warning",
  3: "bg-positive",
  4: "bg-positive",
};

const COR_ROTULO: Record<ForcaPontuacao, string> = {
  0: "text-neutral-500",
  1: "text-negative",
  2: "text-warning",
  3: "text-positive",
  4: "text-positive",
};

/**
 * Medidor de força de senha (UI_SPEC §3.2).
 *
 * O rótulo textual é obrigatório: a barra sozinha não comunica o estado
 * (UI_SPEC §18). A dica lista o próximo passo para melhorar a senha.
 */
export function PasswordStrength({ senha }: PasswordStrengthProps) {
  const forca = avaliarForcaSenha(senha);

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Força da senha:</span>
        <span className={["text-xs font-semibold", COR_ROTULO[forca.pontuacao]].join(" ")}>
          {forca.rotulo}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((indice) => (
          <span
            key={indice}
            className={[
              "h-1.5 flex-1 rounded-full",
              indice <= forca.pontuacao ? COR_SEGMENTO[forca.pontuacao] : "bg-neutral-200",
            ].join(" ")}
          />
        ))}
      </div>
      {forca.dicas.length === 0 ? null : (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-neutral-500">
          {forca.dicas.map((dica) => (
            <li key={dica}>{dica}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
