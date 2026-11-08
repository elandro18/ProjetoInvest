"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { FormError } from "@/src/components/ui/form-error";
import { PasswordField } from "@/src/components/ui/password-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";

interface SessaoResposta {
  readonly usuario: {
    readonly id: string;
    readonly nome: string;
    readonly email: string;
    readonly statusConta: string;
  };
  readonly expiraEm: string;
}

interface MensagemResposta {
  readonly message: string;
}

interface EncerramentoResposta {
  readonly statusConta: string;
  readonly mensagem: string;
}

const ID_SENHA_EXCLUSAO = "senha-exclusao";

/**
 * Tela de conta (UI_SPEC §14.2, RN-088).
 *
 * Três blocos: dados do titular, envio do link de alteração de senha e
 * encerramento com confirmação por senha. A exclusão é irreversível e o
 * diálogo explica a anonimização antes de qualquer ação (UI_SPEC §15).
 */
export function ContaView() {
  const router = useRouter();
  const senhaExclusaoRef = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<SessaoResposta | null>(null);
  const [erroSessao, setErroSessao] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [mensagemSenha, setMensagemSenha] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState("");
  const [erroSenhaExclusao, setErroSenhaExclusao] = useState<string | undefined>(undefined);
  const [erroGeralExclusao, setErroGeralExclusao] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<SessaoResposta>("/api/auth/sessao", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setSessao(resultado.data);
          return;
        }

        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
          setErroSessao(resultado.error.message);
          return;
        }

        setErroSessao(mensagemDeErro(resultado.error));
      } catch (erro) {
        if (erro instanceof DOMException && erro.name === "AbortError") {
          return;
        }
        setErroSessao("Não foi possível carregar os dados da conta. Tente novamente.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativa]);

  function tentarNovamente() {
    setCarregando(true);
    setErroSessao(null);
    setSessaoExpirada(false);
    setSessao(null);
    setTentativa((valor) => valor + 1);
  }

  function tratarErroDeSessao(error: ApiError): boolean {
    if (!ehErroDeSessao(error)) {
      return false;
    }
    setSessaoExpirada(true);
    setErroSessao(error.message);
    return true;
  }

  async function enviarLinkDeSenha() {
    if (sessao === null) {
      return;
    }

    setAlterandoSenha(true);
    setMensagemSenha(null);
    setErroSenha(null);
    try {
      const resultado = await apiRequest<MensagemResposta>("/api/auth/esqueci-senha", {
        method: "POST",
        body: { email: sessao.usuario.email },
      });

      if (!resultado.ok) {
        if (!tratarErroDeSessao(resultado.error)) {
          setErroSenha(mensagemDeErro(resultado.error));
        }
        return;
      }

      setMensagemSenha(resultado.data.message);
    } finally {
      setAlterandoSenha(false);
    }
  }

  function abrirDialogo() {
    setSenhaExclusao("");
    setErroSenhaExclusao(undefined);
    setErroGeralExclusao(null);
    setDialogoAberto(true);
  }

  function fecharDialogo() {
    if (excluindo) {
      return;
    }
    setDialogoAberto(false);
  }

  async function confirmarExclusao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeralExclusao(null);

    if (senhaExclusao.trim() === "") {
      setErroSenhaExclusao("Informe sua senha para confirmar.");
      senhaExclusaoRef.current?.focus();
      return;
    }

    setExcluindo(true);
    try {
      const resultado = await apiRequest<EncerramentoResposta>("/api/conta", {
        method: "DELETE",
        body: { senha: senhaExclusao },
      });

      if (resultado.ok) {
        router.replace("/login?conta=encerrada");
        router.refresh();
        return;
      }

      if (resultado.error.code === "AUTH_CREDENCIAIS_INVALIDAS") {
        setErroSenhaExclusao(resultado.error.message);
        senhaExclusaoRef.current?.focus();
        return;
      }

      if (tratarErroDeSessao(resultado.error)) {
        setDialogoAberto(false);
        return;
      }

      setErroGeralExclusao(mensagemDeErro(resultado.error));
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only">Carregando dados da conta…</span>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-neutral-200" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-36 animate-pulse rounded-xl bg-neutral-200" />
      </div>
    );
  }

  if (sessao === null || sessaoExpirada || erroSessao !== null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Conta</h1>
        <Alert tone="error" title={sessaoExpirada ? "Sessão expirada" : "Não foi possível carregar"}>
          <p>{erroSessao ?? "Dados da conta indisponíveis."}</p>
        </Alert>
        <div className="flex flex-wrap gap-3">
          {sessaoExpirada ? (
            <Link
              href="/login?callbackUrl=%2Fconta"
              className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-neutral-700"
            >
              Entrar novamente
            </Link>
          ) : (
            <Button variant="secondary" onClick={tentarNovamente}>
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Conta</h1>
        <p className="text-sm text-neutral-700">Gerencie seus dados de acesso.</p>
      </div>

      <section aria-labelledby="titulo-dados" className="space-y-3">
        <h2 id="titulo-dados" className="text-lg font-semibold text-neutral-900">
          Dados do titular
        </h2>
        <dl className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:grid-cols-2 sm:p-6">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Nome</dt>
            <dd className="mt-1 break-words text-sm text-neutral-900">{sessao.usuario.nome}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">E-mail</dt>
            <dd className="mt-1 break-all text-sm text-neutral-900">{sessao.usuario.email}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-senha" className="space-y-3">
        <h2 id="titulo-senha" className="text-lg font-semibold text-neutral-900">
          Alterar senha
        </h2>
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
          <p className="text-sm text-neutral-700">
            Enviaremos um link de redefinição para o e-mail da conta. O link expira em 1 hora e
            invalida as sessões abertas após a troca.
          </p>

          {mensagemSenha === null ? null : (
            <Alert tone="success" title="Link enviado">
              {mensagemSenha}
            </Alert>
          )}
          {erroSenha === null ? null : (
            <Alert tone="error" title="Não foi possível enviar">
              {erroSenha}
            </Alert>
          )}

          <Button variant="secondary" onClick={enviarLinkDeSenha} carregando={alterandoSenha}>
            {alterandoSenha ? "Enviando…" : "Enviar link de alteração"}
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="titulo-encerrar"
        className="space-y-3 rounded-xl border border-negative/40 bg-neutral-0 p-4 sm:p-6"
      >
        <h2 id="titulo-encerrar" className="text-lg font-semibold text-negative">
          Encerrar conta
        </h2>
        <p className="text-sm text-neutral-700">
          A exclusão é <strong>irreversível</strong>. Seu nome e e-mail serão anonimizados, os
          acessos serão encerrados e não será possível recuperar a conta. Registros financeiros
          permanecem para integridade e histórico, sem identificação pessoal.
        </p>
        <Button variant="danger" onClick={abrirDialogo}>
          Encerrar conta
        </Button>
      </section>

      <Dialog
        open={dialogoAberto}
        title="Confirmar encerramento"
        onClose={fecharDialogo}
        initialFocusId={ID_SENHA_EXCLUSAO}
        footer={
          <>
            <Button variant="secondary" onClick={fecharDialogo} disabled={excluindo}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="form-encerrar-conta"
              carregando={excluindo}
            >
              {excluindo ? "Encerrando…" : "Encerrar conta"}
            </Button>
          </>
        }
      >
        <p>
          Esta ação não pode ser desfeita. Para confirmar, informe sua senha. Em seguida, seus
          dados pessoais serão anonimizados e você será desconectado.
        </p>

        {erroGeralExclusao === null ? null : (
          <FormError>{erroGeralExclusao}</FormError>
        )}

        <form
          id="form-encerrar-conta"
          noValidate
          onSubmit={confirmarExclusao}
          className="space-y-4"
          aria-busy={excluindo}
        >
          <PasswordField
            ref={senhaExclusaoRef}
            id={ID_SENHA_EXCLUSAO}
            label="Senha atual"
            name="senha-atual"
            autoComplete="current-password"
            value={senhaExclusao}
            error={erroSenhaExclusao}
            onChange={(event) => {
              setSenhaExclusao(event.target.value);
              setErroSenhaExclusao(undefined);
            }}
          />
        </form>
      </Dialog>
    </div>
  );
}
