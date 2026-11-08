import type { Metadata } from "next";

import { sanitizeCallbackUrl } from "@/src/lib/navigation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar — Investment Control" };

export const dynamic = "force-dynamic";

interface LoginPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(
    typeof params.callbackUrl === "string" ? params.callbackUrl : null,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Entrar</h1>
        <p className="text-sm text-neutral-700">Acesse sua conta para continuar.</p>
      </div>
      <LoginForm
        callbackUrl={callbackUrl}
        senhaRedefinida={params.redefinida === "1"}
        contaEncerrada={params.conta === "encerrada"}
      />
    </div>
  );
}
