"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { PasswordField } from "@/src/components/ui/password-field";
import { PasswordStrength } from "@/src/components/ui/password-strength";
import { apiRequest, errosPorCampo, mensagemDeErro, type ApiError } from "@/src/lib/api-client";
import { validarConfirmacao, validarNovaSenha } from "@/src/lib/form-validation";

interface RedefinicaoResposta {
  readonly message: string;
}

interface FalhaToken {
  readonly codigo: string;
  readonly mensagem: string;
}

const CODIGOS_DE_TOKEN: readonly string[] = [
  "AUTH_TOKEN_INVALIDO",
  "AUTH_TOKEN_EXPIRADO",
  "AUTH_TOKEN_JA_USADO",
];

/** Tempo para o titular ler a confirmação antes do redirect ao login. */
const TEMPO_REDIRECIONAMENTO_MS = 2500;

/**
 * Conclusão da redefinição (UI_SPEC §3.4, RN-086).
 *
 * Token inválido/expirado troca a tela por uma ação de novo link — não adianta
 * manter o formulário se o token não é mais aceito. Após o sucesso, o login é
 * o próximo passo.
 */
export interface RedefinirSenhaConteudoProps {
  readonly token: string | null;
}

export function RedefinirSenhaConteudo({ token }: RedefinirSenhaConteudoProps) {
  const router = useRouter();
  const tokenAusente = token === null || token.trim() === "";

  const senhaRef = useRef<HTMLInputElement>(null);
  const confirmacaoRef = useRef<HTMLInputElement>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erros, setErros] = useState<{ senha?: string; confirmacao?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [falhaToken, setFalhaToken] = useState<FalhaToken | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!sucesso) {
      return;
    }
    const timer = setTimeout(() => {
      router.replace("/login?redefinida=1");
      router.refresh();
    }, TEMPO_REDIRECIONAMENTO_MS);
    return () => clearTimeout(timer);
  }, [sucesso, router]);

  function validarCampos(): boolean {
    const erroSenha = validarNovaSenha(novaSenha);
    const erroConfirmacao = validarConfirmacao(novaSenha, confirmacao);
    setErros({ senha: erroSenha ?? undefined, confirmacao: erroConfirmacao ?? undefined });

    if (erroSenha !== null) {
      senhaRef.current?.focus();
      return false;
    }
    if (erroConfirmacao !== null) {
      confirmacaoRef.current?.focus();
      return false;
    }
    return true;
  }

  function tratarErro(error: ApiError) {
    if (CODIGOS_DE_TOKEN.includes(error.code)) {
      setFalhaToken({ codigo: error.code, mensagem: mensagemDeErro(error) });
      return;
    }

    if (error.code === "AUTH_SENHA_FRACA") {
      setErros((atual) => ({ ...atual, senha: error.message }));
      senhaRef.current?.focus();
      return;
    }

    const mapa = errosPorCampo(error);
    const erroSenha = mapa.novaSenha ?? mapa.senha;
    if (erroSenha !== undefined) {
      setErros((atual) => ({ ...atual, senha: erroSenha }));
      senhaRef.current?.focus();
      return;
    }

    setErroGeral(mensagemDeErro(error));
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);

    if (token === null || !validarCampos()) {
      return;
    }

    setEnviando(true);
    try {
      const resultado = await apiRequest<RedefinicaoResposta>("/api/auth/redefinir-senha", {
        method: "POST",
        body: { token: token.trim(), novaSenha },
      });

      if (!resultado.ok) {
        tratarErro(resultado.error);
        return;
      }

      setSucesso(true);
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Senha redefinida">
          Sua senha foi alterada. Você será direcionado ao login.
        </Alert>
        <Link
          href="/login?redefinida=1"
          className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-neutral-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  if (tokenAusente || falhaToken !== null) {
    return (
      <div className="space-y-4">
        <Alert
          tone="error"
          title={falhaToken?.codigo === "AUTH_TOKEN_EXPIRADO" ? "Link expirado" : "Link inválido"}
        >
          <p>
            {falhaToken?.mensagem ??
              "Este link não é válido. Solicite um novo link de redefinição."}
          </p>
        </Alert>
        <Link
          href="/esqueci-senha"
          className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-neutral-700"
        >
          Solicitar novo link
        </Link>
        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-info hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-5" aria-busy={enviando}>
      {erroGeral === null ? null : (
        <Alert tone="error" title="Não foi possível redefinir">
          <p>{erroGeral}</p>
        </Alert>
      )}

      <div className="space-y-2">
        <PasswordField
          ref={senhaRef}
          label="Nova senha"
          name="nova-senha"
          autoComplete="new-password"
          hint="Mínimo de 10 caracteres."
          value={novaSenha}
          error={erros.senha}
          onChange={(event) => {
            setNovaSenha(event.target.value);
            setErros((atual) => ({ ...atual, senha: undefined }));
          }}
          onBlur={() => setErros((atual) => ({ ...atual, senha: validarNovaSenha(novaSenha) ?? undefined }))}
        />
        <PasswordStrength senha={novaSenha} />
      </div>

      <PasswordField
        ref={confirmacaoRef}
        label="Confirmação da nova senha"
        name="confirmacao-senha"
        autoComplete="new-password"
        value={confirmacao}
        error={erros.confirmacao}
        onChange={(event) => {
          setConfirmacao(event.target.value);
          setErros((atual) => ({ ...atual, confirmacao: undefined }));
        }}
        onBlur={() =>
          setErros((atual) => ({
            ...atual,
            confirmacao: validarConfirmacao(novaSenha, confirmacao) ?? undefined,
          }))
        }
      />

      <Button type="submit" larguraTotal carregando={enviando}>
        {enviando ? "Redefinindo…" : "Redefinir senha"}
      </Button>

      <p className="text-center text-sm">
        <Link href="/esqueci-senha" className="font-medium text-info hover:underline">
          Solicitar novo link
        </Link>
      </p>
    </form>
  );
}
