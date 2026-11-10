"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { ErrorState } from "@/src/components/ui/error-state";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import type {
  ConcentracaoApi,
  LimiteApi,
  LimitesApi,
} from "@/src/modules/risco/apresentacao";

import { ConcentracaoPanel } from "./concentracao-panel";
import {
  errosDoServidor,
  idDoCampo,
  linhasDoVigente,
  mapearCampoDoServidor,
  montarPayload,
  novaLinha,
  primeiroCampoComErro,
  validarLinhas,
  type CampoLimite,
  type ErrosLinhaLimite,
  type FocoCampo,
  type LinhaLimiteForm,
  type MapaErrosLimite,
} from "./configuracoes-ui";
import { LimitesForm } from "./limites-form";

const ESTILO_LINK_SECUNDARIO =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50";

interface RespostaPutLimites {
  readonly vigente: readonly LimiteApi[];
}

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

function EsqueletoFormulario() {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">Carregando limites de concentração…</span>
      <div className="h-72 animate-pulse rounded-xl bg-neutral-200" />
    </div>
  );
}

/**
 * `/configuracoes` — limites de concentração e painel atual (RN-049-4;
 * UI_SPEC §14.1, §16–§19; API_CONTRACTS.md §12–§12.2).
 *
 * Dois blocos independentes: o formulário parte do conjunto vigente e o
 * `PUT` substitui tudo de uma vez (a configuração anterior vai para o
 * histórico); o painel consulta a concentração calculada no servidor. Depois
 * de salvar, o painel é recarregado para refletir os limites novos.
 *
 * Erro 422 por campo é mapeado de `details.campo` (`limites[n].percentualMax`)
 * para a linha e o campo correspondentes, com foco no primeiro inválido.
 */
export function ConfiguracoesView() {
  const [linhas, setLinhas] = useState<readonly LinhaLimiteForm[]>([]);
  const [errosCampo, setErrosCampo] = useState<MapaErrosLimite>({});
  const [foco, setFoco] = useState<FocoCampo | null>(null);

  const [carregandoLimites, setCarregandoLimites] = useState(true);
  const [erroLimites, setErroLimites] = useState<string | null>(null);
  const [traceLimites, setTraceLimites] = useState<string | null>(null);
  const [tentativaLimites, setTentativaLimites] = useState(0);

  const [concentracao, setConcentracao] = useState<ConcentracaoApi | null>(null);
  const [carregandoConcentracao, setCarregandoConcentracao] = useState(true);
  const [erroConcentracao, setErroConcentracao] = useState<string | null>(null);
  const [traceConcentracao, setTraceConcentracao] = useState<string | null>(null);
  const [tentativaConcentracao, setTentativaConcentracao] = useState(0);

  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<LimitesApi>("/api/configuracoes/limites", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setLinhas(linhasDoVigente(resultado.data.vigente));
          setErrosCampo({});
          setErroLimites(null);
          setTraceLimites(null);
          return;
        }

        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
        }
        setErroLimites(mensagemDeErro(resultado.error));
        setTraceLimites(lerTraceId(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setErroLimites(
          "Não foi possível carregar os limites. Verifique sua conexão e tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoLimites(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaLimites]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<ConcentracaoApi>("/api/risco/concentracao", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setConcentracao(resultado.data);
          setErroConcentracao(null);
          setTraceConcentracao(null);
          return;
        }

        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
        }
        setConcentracao(null);
        setErroConcentracao(mensagemDeErro(resultado.error));
        setTraceConcentracao(lerTraceId(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setConcentracao(null);
        setErroConcentracao("Não foi possível carregar a concentração da carteira.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoConcentracao(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaConcentracao]);

  useEffect(() => {
    if (foco === null) {
      return;
    }

    document.getElementById(idDoCampo(foco.linhaId, foco.campo))?.focus();
  }, [foco]);

  function alterarLinha(id: string, campo: CampoLimite, valor: string) {
    setLinhas((atuais) =>
      atuais.map((linha) => (linha.id === id ? { ...linha, [campo]: valor } : linha)),
    );
    setErroSalvar(null);
    setErrosCampo((atuais) => {
      const errosDaLinha = atuais[id];
      if (errosDaLinha === undefined) {
        return atuais;
      }
      return { ...atuais, [id]: { ...errosDaLinha, [campo]: undefined } };
    });
  }

  function adicionarLinha() {
    setErroSalvar(null);
    setLinhas((atuais) => [...atuais, novaLinha()]);
  }

  function removerLinha(id: string) {
    setErroSalvar(null);
    setLinhas((atuais) => atuais.filter((linha) => linha.id !== id));
    setErrosCampo((atuais) => {
      if (atuais[id] === undefined) {
        return atuais;
      }
      const copia: Record<string, ErrosLinhaLimite> = { ...atuais };
      delete copia[id];
      return copia;
    });
  }

  function abrirConfirmacao() {
    const erros = validarLinhas(linhas);
    const primeiro = primeiroCampoComErro(linhas, erros);
    if (primeiro !== null) {
      setErrosCampo(erros);
      setFoco(primeiro);
      setErroSalvar("Revise os campos destacados e tente novamente.");
      return;
    }

    setErrosCampo({});
    setErroSalvar(null);
    setConfirmacaoAberta(true);
  }

  async function confirmarSalvamento() {
    setSalvando(true);
    setErroSalvar(null);

    try {
      const resultado = await apiRequest<RespostaPutLimites>("/api/configuracoes/limites", {
        method: "PUT",
        body: montarPayload(linhas),
      });

      if (resultado.ok) {
        setLinhas(linhasDoVigente(resultado.data.vigente));
        setErrosCampo({});
        setConfirmacaoAberta(false);
        setFeedback(
          "Limites salvos. A configuração anterior foi preservada no histórico e o painel foi atualizado.",
        );
        setCarregandoConcentracao(true);
        setErroConcentracao(null);
        setTraceConcentracao(null);
        setTentativaConcentracao((valor) => valor + 1);
        return;
      }

      setConfirmacaoAberta(false);

      if (resultado.error.code === "RISCO_LIMITE_INVALIDO") {
        const campoDoServidor = mapearCampoDoServidor(resultado.error, linhas);
        if (campoDoServidor !== null) {
          setErrosCampo(errosDoServidor(linhas, campoDoServidor));
          setFoco(campoDoServidor);
          setErroSalvar(
            "Limite inválido. Revise o campo destacado e tente novamente.",
          );
          return;
        }
      }

      if (ehErroDeSessao(resultado.error)) {
        setSessaoExpirada(true);
      }
      setErroSalvar(mensagemDeErro(resultado.error));
    } catch {
      setConfirmacaoAberta(false);
      setErroSalvar(
        "Não foi possível salvar os limites. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function tentarNovamenteLimites() {
    setCarregandoLimites(true);
    setErroLimites(null);
    setTraceLimites(null);
    setSessaoExpirada(false);
    setTentativaLimites((valor) => valor + 1);
  }

  function tentarNovamenteConcentracao() {
    setCarregandoConcentracao(true);
    setErroConcentracao(null);
    setTraceConcentracao(null);
    setSessaoExpirada(false);
    setTentativaConcentracao((valor) => valor + 1);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Configurações</h1>
        <p className="text-sm text-neutral-700">
          Defina os limites de concentração da carteira e acompanhe a participação atual por
          dimensão.
        </p>
      </div>

      {feedback === null ? null : (
        <Alert
          tone="success"
          title="Limites salvos"
          action={
            <Button variant="ghost" onClick={() => setFeedback(null)}>
              Fechar
            </Button>
          }
        >
          <p>{feedback}</p>
        </Alert>
      )}

      {erroSalvar === null ? null : (
        <Alert
          tone="error"
          title="Não foi possível salvar os limites"
          action={
            sessaoExpirada ? (
              <Link
                href="/login?callbackUrl=%2Fconfiguracoes"
                className={ESTILO_LINK_SECUNDARIO}
              >
                Entrar novamente
              </Link>
            ) : undefined
          }
        >
          <p>{erroSalvar}</p>
        </Alert>
      )}

      {carregandoLimites ? (
        <EsqueletoFormulario />
      ) : erroLimites !== null ? (
        <ErrorState
          title="Não foi possível carregar os limites"
          message={erroLimites}
          traceId={traceLimites}
          onRetry={sessaoExpirada ? undefined : tentarNovamenteLimites}
          action={
            sessaoExpirada ? (
              <Link
                href="/login?callbackUrl=%2Fconfiguracoes"
                className={ESTILO_LINK_SECUNDARIO}
              >
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : (
        <LimitesForm
          linhas={linhas}
          erros={errosCampo}
          salvando={salvando}
          onAlterar={alterarLinha}
          onAdicionar={adicionarLinha}
          onRemover={removerLinha}
          onSalvar={abrirConfirmacao}
        />
      )}

      <ConcentracaoPanel
        concentracao={concentracao}
        carregando={carregandoConcentracao}
        erro={erroConcentracao}
        traceId={traceConcentracao}
        onRetry={tentarNovamenteConcentracao}
        sessaoExpirada={sessaoExpirada}
      />

      <Dialog
        open={confirmacaoAberta}
        title="Salvar limites de concentração"
        onClose={() => {
          if (!salvando) {
            setConfirmacaoAberta(false);
          }
        }}
        initialFocusId="confirmar-limites"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmacaoAberta(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button id="confirmar-limites" onClick={confirmarSalvamento} carregando={salvando}>
              Confirmar salvamento
            </Button>
          </>
        }
      >
        <p>
          {linhas.length === 0
            ? "Nenhum limite ficará vigente. O painel continuará mostrando os percentuais, sem badge de excedido. A configuração anterior passa para o histórico."
            : "A configuração vigente passa para o histórico e os novos limites valem a partir de hoje. O painel de concentração será recalculado na sequência."}
        </p>
      </Dialog>
    </div>
  );
}
