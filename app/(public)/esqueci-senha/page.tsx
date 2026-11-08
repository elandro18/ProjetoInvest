import type { Metadata } from "next";

import { EsqueciSenhaForm } from "./esqueci-senha-form";

export const metadata: Metadata = { title: "Esqueci minha senha — Investment Control" };

export default function EsqueciSenhaPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Esqueci minha senha</h1>
        <p className="text-sm text-neutral-700">
          Informe o e-mail da conta para receber o link de redefinição.
        </p>
      </div>
      <EsqueciSenhaForm />
    </div>
  );
}
