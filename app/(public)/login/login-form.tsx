"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { PasswordField } from "@/src/components/ui/password-field";
import { TextField } from "@/src/components/ui/text-field";
import { apiRequest, errosPorCampo, mensagemDeErro, type ApiError } from "@/src/lib/api-client";
import { validarEmail, validarSenhaInformada } from "@/src/lib/form-validation";

interface LoginResposta {
  readonly usuario: {
    readonly id: string;
    readonly nome: string;
    readonly email: string;
    readonly statusConta: string;
  };
}

interface ReenvioResposta {
  readonly message: string;
}

interface ErrosCampos {
  email?: string;
  senha?: string;
}

export interface LoginFormProps {
  readonly callbackUrl?: string | null;
  readonly senhaRedefinida?: boolean;
  readonly contaEncerrada?: boolean;
}

/**
 * Login por credenciais (UI_SPEC §3.1, RN-085).
 *
 * Erro de credencial é sempre genérico; e-mail não verificado ganha ação de
 * reenvio. O destino pós-login é o `callbackUrl` interno validado — nunca uma
 * URL externa (SECURITY.md §6).
 */
export function LoginForm({
  callbackUrl = null,
  senhaRedefinida = false,
  contaEncerrada = false,
}: LoginFormProps = {}) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [podeReenviar, setPodeReenviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState<string | null>(null);

  function limparErro(campo: keyof ErrosCampos) {
    setErros((atual) => {
      if (atual[campo] === undefined) {
        return atual;
      }
      const proximo = { ...atual };
      delete proximo[campo];
      return proximo;
    });
  }

  function validarCampo(campo: keyof ErrosCampos) {
    const mensagem =
      campo === "email" ? validarEmail(email) : validarSenhaInformada(senha);
    setErros((atual) => ({ ...atual, [campo]: mensagem ?? undefined }));
    return mensagem === null;
  }

  function focarPrimeiroErro(mapa: Record<string, string>) {
    if (mapa.email !== undefined) {
      emailRef.current?.focus();
      return;
    }
    if (mapa.senha !== undefined) {
      senhaRef.current?.focus();
    }
  }

  function tratarErro(error: ApiError) {
    const mapa = errosPorCampo(error);
    if (Object.keys(mapa).length > 0) {
      setErros({ email: mapa.email, senha: mapa.senha });
      focarPrimeiroErro(mapa);
      return;
    }

    setErroGeral(mensagemDeErro(error));
    setPodeReenviar(error.code === "AUTH_EMAIL_NAO_VERIFICADO");
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);
    setMensagemReenvio(null);

    const emailOk = validarCampo("email");
    const senhaOk = validarCampo("senha");
    if (!emailOk || !senhaOk) {
      if (!emailOk) {
        emailRef.current?.focus();
      } else {
        senhaRef.current?.focus();
      }
      return;
    }

    setEnviando(true);
    try {
      const resultado = await apiRequest<LoginResposta>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), senha },
      });

      if (!resultado.ok) {
        tratarErro(resultado.error);
        return;
      }

      router.push(callbackUrl ?? "/conta");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  async function reenviarVerificacao() {
    setReenviando(true);
    setMensagemReenvio(null);
    try {
      const resultado = await apiRequest<ReenvioResposta>("/api/auth/reenviar-verificacao", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });

      setMensagemReenvio(
        resultado.ok
          ? resultado.data.message
          : mensagemDeErro(resultado.error),
      );
    } finally {
      setReenviando(false);
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-5" aria-busy={enviando}>
      {senhaRedefinida ? (
        <Alert tone="success" title="Senha redefinida">
          Entre com a nova senha.
        </Alert>
      ) : null}

      {contaEncerrada ? (
        <Alert tone="info" title="Conta encerrada">
          Seus dados pessoais foram anonimizados.
        </Alert>
      ) : null}

      {erroGeral === null ? null : (
        <Alert
          tone="error"
          title="Não foi possível entrar"
          action={
            podeReenviar ? (
              <Button variant="secondary" onClick={reenviarVerificacao} carregando={reenviando}>
                Reenviar verificação
              </Button>
            ) : undefined
          }
        >
          <p>{erroGeral}</p>
        </Alert>
      )}

      {mensagemReenvio === null ? null : (
        <Alert tone="info" title="Reenvio de verificação">
          {mensagemReenvio}
        </Alert>
      )}

      <TextField
        ref={emailRef}
        label="E-mail"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="titular@exemplo.com"
        value={email}
        error={erros.email}
        onChange={(event) => {
          setEmail(event.target.value);
          limparErro("email");
        }}
        onBlur={() => validarCampo("email")}
      />

      <PasswordField
        ref={senhaRef}
        label="Senha"
        name="senha"
        autoComplete="current-password"
        value={senha}
        error={erros.senha}
        onChange={(event) => {
          setSenha(event.target.value);
          limparErro("senha");
        }}
        onBlur={() => validarCampo("senha")}
      />

      <Button type="submit" larguraTotal carregando={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/esqueci-senha" className="text-info hover:underline">
          Esqueci minha senha
        </Link>
        <p className="text-neutral-700">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-info hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </form>
  );
}
