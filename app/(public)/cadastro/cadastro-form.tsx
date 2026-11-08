"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type RefObject } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { PasswordField } from "@/src/components/ui/password-field";
import { PasswordStrength } from "@/src/components/ui/password-strength";
import { TextField } from "@/src/components/ui/text-field";
import { VERSAO_POLITICA_PRIVACIDADE, VERSAO_TERMOS_USO } from "@/src/modules/conta/legal";
import { apiRequest, errosPorCampo, mensagemDeErro, type ApiError } from "@/src/lib/api-client";
import {
  validarConfirmacao,
  validarEmail,
  validarNome,
  validarNovaSenha,
} from "@/src/lib/form-validation";

interface CadastroResposta {
  readonly id: string;
  readonly email: string;
  readonly statusConta: string;
}

interface ErrosCampos {
  nome?: string;
  email?: string;
  senha?: string;
  confirmacao?: string;
}

const CAMPOS: readonly (keyof ErrosCampos)[] = ["nome", "email", "senha", "confirmacao"];

/**
 * Cadastro de titular (UI_SPEC §3.2, RN-085, RN-087).
 *
 * O botão fica desabilitado até os dois aceites (regra estrutural — UI_SPEC
 * §16). Erro 422 marca os campos e preserva tudo o que foi digitado; o foco
 * vai para o primeiro campo inválido.
 */
export function CadastroForm() {
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const confirmacaoRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceitePrivacidade, setAceitePrivacidade] = useState(false);
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroAceites, setErroAceites] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [emailJaCadastrado, setEmailJaCadastrado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState(false);

  const aceitesOk = aceiteTermos && aceitePrivacidade;

  function refDoCampo(campo: keyof ErrosCampos): RefObject<HTMLInputElement | null> {
    switch (campo) {
      case "nome":
        return nomeRef;
      case "email":
        return emailRef;
      case "senha":
        return senhaRef;
      case "confirmacao":
        return confirmacaoRef;
    }
  }

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

  function validarCampo(campo: keyof ErrosCampos): boolean {
    const mensagens: Record<keyof ErrosCampos, string | null> = {
      nome: validarNome(nome),
      email: validarEmail(email),
      senha: validarNovaSenha(senha),
      confirmacao: validarConfirmacao(senha, confirmacao),
    };
    const mensagem = mensagens[campo];
    setErros((atual) => ({ ...atual, [campo]: mensagem ?? undefined }));
    return mensagem === null;
  }

  function tratarErro(error: ApiError) {
    if (error.code === "AUTH_SENHA_FRACA") {
      setErros((atual) => ({ ...atual, senha: error.message }));
      senhaRef.current?.focus();
      return;
    }

    if (error.code === "AUTH_ACEITE_OBRIGATORIO") {
      setErroAceites(error.message);
      return;
    }

    const mapa = errosPorCampo(error);
    if (Object.keys(mapa).length > 0) {
      setErros({
        nome: mapa.nome,
        email: mapa.email,
        senha: mapa.senha ?? mapa.novaSenha,
      });
      const primeiro = CAMPOS.find((campo) => mapa[campo] !== undefined);
      if (primeiro !== undefined) {
        refDoCampo(primeiro).current?.focus();
      }
      return;
    }

    setEmailJaCadastrado(error.code === "AUTH_EMAIL_JA_CADASTRADO");
    setErroGeral(mensagemDeErro(error));
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);
    setEmailJaCadastrado(false);

    if (!aceitesOk) {
      setErroAceites("É necessário aceitar os termos e a política de privacidade.");
      return;
    }

    const validos = CAMPOS.map((campo) => validarCampo(campo));
    const primeiroInvalido = CAMPOS.find((_campo, indice) => !validos[indice]);
    if (primeiroInvalido !== undefined) {
      refDoCampo(primeiroInvalido).current?.focus();
      return;
    }

    setEnviando(true);
    try {
      const resultado = await apiRequest<CadastroResposta>("/api/auth/cadastro", {
        method: "POST",
        body: {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          aceiteTermos,
          aceitePrivacidade,
          versaoTermos: VERSAO_TERMOS_USO,
          versaoPrivacidade: VERSAO_POLITICA_PRIVACIDADE,
        },
      });

      if (!resultado.ok) {
        tratarErro(resultado.error);
        return;
      }

      setCriada(true);
    } finally {
      setEnviando(false);
    }
  }

  if (criada) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Conta criada">
          Confirme seu e-mail para ativar o acesso.
        </Alert>
        <p className="text-sm text-neutral-700">
          Enviamos um link de confirmação para{" "}
          <strong className="break-all text-neutral-900">{email.trim().toLowerCase()}</strong>. O
          link expira em 24 horas.
        </p>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-neutral-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-5" aria-busy={enviando}>
      {erroGeral === null ? null : (
        <Alert
          tone="error"
          title={emailJaCadastrado ? "E-mail já cadastrado" : "Não foi possível criar a conta"}
          action={
            emailJaCadastrado ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link href="/login" className="font-medium text-info hover:underline">
                  Fazer login
                </Link>
                <Link href="/esqueci-senha" className="font-medium text-info hover:underline">
                  Recuperar senha
                </Link>
              </div>
            ) : undefined
          }
        >
          <p>{erroGeral}</p>
        </Alert>
      )}

      <TextField
        ref={nomeRef}
        label="Nome"
        name="nome"
        autoComplete="name"
        value={nome}
        error={erros.nome}
        onChange={(event) => {
          setNome(event.target.value);
          limparErro("nome");
        }}
        onBlur={() => validarCampo("nome")}
      />

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

      <div className="space-y-2">
        <PasswordField
          ref={senhaRef}
          label="Senha"
          name="nova-senha"
          autoComplete="new-password"
          hint="Mínimo de 10 caracteres."
          value={senha}
          error={erros.senha}
          onChange={(event) => {
            setSenha(event.target.value);
            limparErro("senha");
          }}
          onBlur={() => validarCampo("senha")}
        />
        <PasswordStrength senha={senha} />
      </div>

      <PasswordField
        ref={confirmacaoRef}
        label="Confirmação de senha"
        name="confirmacao-senha"
        autoComplete="new-password"
        value={confirmacao}
        error={erros.confirmacao}
        onChange={(event) => {
          setConfirmacao(event.target.value);
          limparErro("confirmacao");
        }}
        onBlur={() => validarCampo("confirmacao")}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-neutral-900">Consentimentos obrigatórios</legend>
        <Checkbox
          checked={aceiteTermos}
          onChange={(event) => {
            setAceiteTermos(event.target.checked);
            setErroAceites(null);
          }}
          error={erroAceites ?? undefined}
          label={
            <>
              Li e aceito os{" "}
              <Link
                href="/termos"
                prefetch={false}
                className="font-medium text-info hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Termos de Uso
              </Link>{" "}
              (versão {VERSAO_TERMOS_USO}).
            </>
          }
        />
        <Checkbox
          checked={aceitePrivacidade}
          onChange={(event) => {
            setAceitePrivacidade(event.target.checked);
            setErroAceites(null);
          }}
          label={
            <>
              Li e aceito a{" "}
              <Link
                href="/privacidade"
                prefetch={false}
                className="font-medium text-info hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Política de Privacidade
              </Link>{" "}
              (versão {VERSAO_POLITICA_PRIVACIDADE}).
            </>
          }
        />
      </fieldset>

      {aceitesOk ? null : (
        <p id="aceites-explicacao" className="text-xs text-neutral-500">
          Aceite os dois documentos para liberar a criação da conta.
        </p>
      )}

      <Button
        type="submit"
        larguraTotal
        carregando={enviando}
        disabled={!aceitesOk}
        aria-describedby={aceitesOk ? undefined : "aceites-explicacao"}
      >
        {enviando ? "Criando conta…" : "Criar conta"}
      </Button>

      <p className="text-sm text-neutral-700">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-info hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
