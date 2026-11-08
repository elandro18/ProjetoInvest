"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { TextField } from "@/src/components/ui/text-field";
import { apiRequest, errosPorCampo, mensagemDeErro } from "@/src/lib/api-client";
import { validarEmail } from "@/src/lib/form-validation";

interface MensagemResposta {
  readonly message: string;
}

interface MensagemReenvio {
  readonly tone: "success" | "error";
  readonly texto: string;
}

/**
 * Solicitação de redefinição (UI_SPEC §3.4, RN-086).
 *
 * A resposta é sempre neutra: o titular não descobre se o e-mail existe. O
 * mesmo cuidado vale para o reenvio de verificação, oferecido como ação
 * secundária quando a conta ainda não foi confirmada.
 */
export function EsqueciSenhaForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string | undefined>(undefined);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState<MensagemReenvio | null>(null);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);
    setMensagem(null);

    const validacao = validarEmail(email);
    setErroEmail(validacao ?? undefined);
    if (validacao !== null) {
      emailRef.current?.focus();
      return;
    }

    setEnviando(true);
    try {
      const resultado = await apiRequest<MensagemResposta>("/api/auth/esqueci-senha", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });

      if (!resultado.ok) {
        const mapa = errosPorCampo(resultado.error);
        if (mapa.email !== undefined) {
          setErroEmail(mapa.email);
          emailRef.current?.focus();
        } else {
          setErroGeral(mensagemDeErro(resultado.error));
        }
        return;
      }

      setMensagem(resultado.data.message);
    } finally {
      setEnviando(false);
    }
  }

  async function reenviarVerificacao() {
    setMensagemReenvio(null);
    const validacao = validarEmail(email);
    setErroEmail(validacao ?? undefined);
    if (validacao !== null) {
      emailRef.current?.focus();
      return;
    }

    setReenviando(true);
    try {
      const resultado = await apiRequest<MensagemResposta>("/api/auth/reenviar-verificacao", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setMensagemReenvio(
        resultado.ok
          ? { tone: "success", texto: resultado.data.message }
          : { tone: "error", texto: mensagemDeErro(resultado.error) },
      );
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <form noValidate onSubmit={enviar} className="space-y-5" aria-busy={enviando}>
        {erroGeral === null ? null : (
          <Alert tone="error" title="Não foi possível enviar">
            <p>{erroGeral}</p>
          </Alert>
        )}

        {mensagem === null ? null : (
          <Alert tone="success" title="Verifique seu e-mail">
            <p>{mensagem}</p>
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
          error={erroEmail}
          onChange={(event) => {
            setEmail(event.target.value);
            setErroEmail(undefined);
          }}
          onBlur={() => setErroEmail(validarEmail(email) ?? undefined)}
        />

        <Button type="submit" larguraTotal carregando={enviando}>
          {enviando ? "Enviando…" : "Enviar link de redefinição"}
        </Button>
      </form>

      <div className="space-y-2 border-t border-neutral-200 pt-4 text-sm">
        <p className="text-neutral-700">
          Ainda não confirmou o e-mail do cadastro?{" "}
          <button
            type="button"
            onClick={reenviarVerificacao}
            disabled={reenviando}
            className="font-medium text-info hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reenviando ? "Reenviando…" : "Reenviar verificação"}
          </button>
        </p>
        {mensagemReenvio === null ? null : (
          <Alert
            tone={mensagemReenvio.tone}
            title={mensagemReenvio.tone === "error" ? "Não foi possível reenviar" : "Reenvio de verificação"}
          >
            {mensagemReenvio.texto}
          </Alert>
        )}
        <p>
          <Link href="/login" className="font-medium text-info hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
