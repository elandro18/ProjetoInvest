import type { Metadata } from "next";

import { CadastroForm } from "./cadastro-form";

export const metadata: Metadata = { title: "Criar conta — Investment Control" };

export default function CadastroPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Criar conta</h1>
        <p className="text-sm text-neutral-700">
          Cadastro aberto. Você receberá um link para confirmar o e-mail.
        </p>
      </div>
      <CadastroForm />
    </div>
  );
}
