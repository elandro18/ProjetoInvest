"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { TextField } from "@/src/components/ui/text-field";
import { apiRequest, mensagemDeErro, type ApiResult } from "@/src/lib/api-client";
import { validarEmail } from "@/src/lib/form-validation";

interface VerificacaoResposta {
  readonly statusConta: string;
  readonly emailVerificadoEm: string;
}

interface ReenvioResposta {
  readonly message: string;
}

type Estado =
  | { readonly tipo: "verificando" }
  | { readonly tipo: "sucesso" }
  | { readonly tipo: "falha"; readonly codigo: string; readonly mensagem: string };

interface VerificacaoEmCurso {
  readonly token: string;
  readonly promise: Promise<ApiResult<VerificacaoResposta>>;
}

interface MensagemReenvio {
  readonly tone: "success" | "error";
  readonly texto: string;
}

export interface VerificarEmailConteudoProps {
  readonly token: string | null;
}

/**
 * Verificação de e-mail por token (UI_SPEC §3.3, RN-085).
 *
 * O token é de uso único. A requisição em curso é guardada em `useRef` e
 * reaproveitada pelo segundo disparo do StrictMode em desenvolvimento — assim
 * o link não é consumido duas vezes nem fica preso em "verificando".
 */
export function VerificarEmailConteudo({ token }: VerificarEmailConteudoProps) {
  const tokenAusente = token === null || token.trim() === "";
  const emCurso = useRef<VerificacaoEmCurso | null>(null);

  const [estado, setEstado] = useState<Estado>({ tipo: "verificando" });
  const [email, setEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState<MensagemReenvio | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (token === null || token.trim() === "") {
      return;
    }

    if (emCurso.current?.token !== token) {
      emCurso.current = {
        token,
        promise: apiRequest<VerificacaoResposta>("/api/auth/verificar-email", {
          method: "POST",
          body: { token },
        }),
      };
    }

    let ativo = true;
    const promise = emCurso.current.promise;

    promise
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        if (resultado.ok) {
          setEstado({ tipo: "sucesso" });
          return;
        }
        setEstado({
          tipo: "falha",
          codigo: resultado.error.code,
          mensagem: mensagemDeErro(resultado.error),
        });
      })
      .catch(() => {
        if (!ativo) {
          return;
        }
        setEstado({
          tipo: "falha",
          codigo: "ERRO_REDE",
          mensagem: "Não foi possível conectar. Tente novamente.",
        });
      });

    return () => {
      ativo = false;
    };
  }, [token]);

  const estadoEfetivo: Estado = tokenAusente
    ? { tipo: "falha", codigo: "AUTH_TOKEN_INVALIDO", mensagem: "Link inválido." }
    : estado;

  async function reenviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validacao = validarEmail(email);
    setErroEmail(validacao ?? undefined);
    if (validacao !== null) {
      emailRef.current?.focus();
      return;
    }

    setEnviando(true);
    setMensagemReenvio(null);
    try {
      const resultado = await apiRequest<ReenvioResposta>("/api/auth/reenviar-verificacao", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setMensagemReenvio(
        resultado.ok
          ? { tone: "success", texto: resultado.data.message }
          : { tone: "error", texto: mensagemDeErro(resultado.error) },
      );
    } finally {
      setEnviando(false);
    }
  }

  if (estadoEfetivo.tipo === "verificando") {
    return (
      <div aria-busy="true">
        <Alert tone="info" title="Verificando">
          Aguarde enquanto confirmamos seu e-mail.
        </Alert>
      </div>
    );
  }

  if (estadoEfetivo.tipo === "sucesso") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="E-mail confirmado">
          Sua conta está ativa. Você já pode entrar.
        </Alert>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-neutral-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  const jaUsado = estadoEfetivo.codigo === "AUTH_TOKEN_JA_USADO";

  return (
    <div className="space-y-4">
      <Alert
        tone="error"
        title={jaUsado ? "Link já utilizado" : "Não foi possível verificar"}
      >
        <p>{estadoEfetivo.mensagem}</p>
      </Alert>

      {jaUsado ? (
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-neutral-700"
        >
          Ir para o login
        </Link>
      ) : (
        <form noValidate onSubmit={reenviar} className="space-y-4" aria-busy={enviando}>
          <p className="text-sm text-neutral-700">
            Informe o e-mail da conta para receber um novo link de confirmação.
          </p>
          <TextField
            ref={emailRef}
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            error={erroEmail}
            onChange={(event) => {
              setEmail(event.target.value);
              setErroEmail(undefined);
            }}
            onBlur={() => setErroEmail(validarEmail(email) ?? undefined)}
          />
          <Button type="submit" larguraTotal carregando={enviando}>
            {enviando ? "Reenviando…" : "Reenviar link"}
          </Button>
          {mensagemReenvio === null ? null : (
            <Alert
              tone={mensagemReenvio.tone}
              title={mensagemReenvio.tone === "error" ? "Não foi possível reenviar" : "Reenvio de verificação"}
            >
              {mensagemReenvio.texto}
            </Alert>
          )}
        </form>
      )}
    </div>
  );
}
