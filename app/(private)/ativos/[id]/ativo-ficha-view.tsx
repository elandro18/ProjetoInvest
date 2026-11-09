"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { apiRequest, ehErroDeSessao, mensagemDeErro } from "@/src/lib/api-client";
import { AtivoEdicaoForm } from "./ativo-edicao-form";
import {
  TONS_STATUS,
  formatarCnpj,
  formatarDataHora,
  rotuloStatus,
  valorOuNaoInformado,
  type AtivoDetalheApi,
  type ReferenciaAtivosApi,
  type StatusAtivo,
} from "../ativos-ui";

type Aba = "visao-geral" | "movimentacoes" | "rendimentos" | "precos" | "ficha-externa";

const ABAS: readonly { readonly id: Aba; readonly rotulo: string }[] = [
  { id: "visao-geral", rotulo: "Visão geral" },
  { id: "movimentacoes", rotulo: "Movimentações" },
  { id: "rendimentos", rotulo: "Rendimentos" },
  { id: "precos", rotulo: "Histórico de preços" },
  { id: "ficha-externa", rotulo: "Ficha externa" },
];

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";

export interface AtivoFichaProps {
  readonly ativoId: string;
}

/**
 * Ficha do ativo (UI_SPEC §6.3, RN-010-5).
 *
 * Posição e cotação nascem vazias na Fase 1: "sem posição" e "indisponível"
 * são estados explícitos — nunca zero inventado (RN-091). Abas de
 * movimentações/rendimentos existem como "disponível em breve" até RN-014 e
 * RN-017; a ficha externa é um placeholder da Fase 3.
 */
export function AtivoFichaView({ ativoId }: AtivoFichaProps) {
  const [carregando, setCarregando] = useState(true);
  const [ativo, setAtivo] = useState<AtivoDetalheApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [codigoErro, setCodigoErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const [referencia, setReferencia] = useState<ReferenciaAtivosApi | null>(null);
  const [erroReferencia, setErroReferencia] = useState(false);

  const [aba, setAba] = useState<Aba>("visao-geral");
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [dialogoStatus, setDialogoStatus] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<AtivoDetalheApi>(`/api/ativos/${ativoId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setAtivo(resultado.data);
          return;
        }

        setAtivo(null);
        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
          setErro(resultado.error.message);
          return;
        }
        setErro(mensagemDeErro(resultado.error));
        setCodigoErro(resultado.error.code);
        setTraceId(
          typeof resultado.error.details?.traceId === "string"
            ? resultado.error.details.traceId
            : null,
        );
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setAtivo(null);
        setErro("Não foi possível carregar o ativo. Verifique sua conexão e tente novamente.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [ativoId, tentativa]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<ReferenciaAtivosApi>("/api/referencia/ativos", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (resultado.ok) {
          setReferencia(resultado.data);
          return;
        }
        setErroReferencia(true);
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setErroReferencia(true);
      }
    })();

    return () => controller.abort();
  }, []);

  function selecionarAba(id: Aba) {
    setAba(id);
    if (id !== "visao-geral") {
      setEditando(false);
    }
  }

  function recarregar() {
    setCarregando(true);
    setErro(null);
    setCodigoErro(null);
    setTraceId(null);
    setSessaoExpirada(false);
    setTentativa((valor) => valor + 1);
  }

  function aoTeclarAba(event: KeyboardEvent<HTMLButtonElement>, indice: number) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    let novoIndice = indice;
    if (event.key === "ArrowRight") {
      novoIndice = (indice + 1) % ABAS.length;
    } else if (event.key === "ArrowLeft") {
      novoIndice = (indice - 1 + ABAS.length) % ABAS.length;
    } else if (event.key === "Home") {
      novoIndice = 0;
    } else {
      novoIndice = ABAS.length - 1;
    }

    const destino = ABAS[novoIndice];
    selecionarAba(destino.id);
    document.getElementById(`aba-${destino.id}`)?.focus();
  }

  async function confirmarAlteracaoDeStatus() {
    if (ativo === null) {
      return;
    }

    const novoStatus: StatusAtivo = ativo.status === "INATIVO" ? "ATIVO" : "INATIVO";
    setAlterandoStatus(true);
    setErroAcao(null);
    try {
      const resultado = await apiRequest<AtivoDetalheApi>(`/api/ativos/${ativo.id}`, {
        method: "PATCH",
        body: { status: novoStatus },
      });

      if (!resultado.ok) {
        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
          setDialogoStatus(false);
          return;
        }
        setDialogoStatus(false);
        setErroAcao(mensagemDeErro(resultado.error));
        return;
      }

      setAtivo(resultado.data);
      setDialogoStatus(false);
      setAviso(novoStatus === "INATIVO" ? "Ativo inativado." : "Ativo reativado.");
    } finally {
      setAlterandoStatus(false);
    }
  }

  if (carregando) {
    return (
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only">Carregando ativo…</span>
        <div className="h-9 w-48 animate-pulse rounded-lg bg-neutral-200" />
        <div className="h-64 animate-pulse rounded-xl bg-neutral-200" />
      </div>
    );
  }

  if (sessaoExpirada) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Ficha do ativo</h1>
        <ErrorState
          title="Sessão expirada"
          message={erro ?? "Sua sessão expirou. Entre novamente."}
          action={
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/ativos/${ativoId}`)}`}
              className={ESTILO_BOTAO_PRIMARIO}
            >
              Entrar novamente
            </Link>
          }
        />
      </div>
    );
  }

  if (codigoErro === "ATIVO_NAO_ENCONTRADO") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Ficha do ativo</h1>
        <EmptyState
          title="Ativo não encontrado"
          description="O ativo não existe ou não pertence à sua conta."
          action={
            <Link href="/ativos" className={ESTILO_BOTAO_PRIMARIO}>
              Voltar para ativos
            </Link>
          }
        />
      </div>
    );
  }

  if (erro !== null || ativo === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Ficha do ativo</h1>
        <ErrorState
          message={erro ?? "Ativo indisponível."}
          traceId={traceId}
          onRetry={recarregar}
          action={
            <Link href="/ativos" className={ESTILO_BOTAO_PRIMARIO}>
              Voltar para ativos
            </Link>
          }
        />
      </div>
    );
  }

  const classes = referencia?.classes ?? null;
  const inativar = ativo.status !== "INATIVO";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{ativo.ticker}</h1>
            <StatusBadge tone={TONS_STATUS[ativo.status]}>{rotuloStatus(ativo.status)}</StatusBadge>
          </div>
          <p className="break-words text-sm text-neutral-700">{ativo.nome}</p>
          <p className="text-sm text-neutral-700">
            {ativo.classe.nome}
            {ativo.segmento === null ? "" : ` · ${ativo.segmento.nome}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/ativos" className="inline-flex items-center px-2 py-1 text-sm text-info hover:underline">
            Voltar
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setAba("visao-geral");
              setEditando(true);
              setAviso(null);
            }}
            disabled={editando}
          >
            Editar
          </Button>
          <Button
            variant={inativar ? "danger" : "secondary"}
            onClick={() => {
              setErroAcao(null);
              setDialogoStatus(true);
            }}
          >
            {inativar ? "Inativar" : "Reativar"}
          </Button>
        </div>
      </div>

      {aviso === null ? null : (
        <Alert
          tone="success"
          title="Atualizado"
          action={
            <Button variant="ghost" onClick={() => setAviso(null)}>
              Fechar
            </Button>
          }
        >
          {aviso}
        </Alert>
      )}

      {erroAcao === null ? null : (
        <Alert tone="error" title="Não foi possível concluir">
          {erroAcao}
        </Alert>
      )}

      {!erroReferencia || referencia !== null || !editando ? null : (
        <Alert tone="warning" title="Catálogo de segmentos indisponível">
          <p>
            Você pode editar os demais campos; o segmento atual será mantido até o catálogo
            voltar.
          </p>
        </Alert>
      )}

      <div role="tablist" aria-label="Seções do ativo" className="flex flex-wrap gap-1 border-b border-neutral-200">
        {ABAS.map((item, indice) => {
          const selecionada = aba === item.id;
          return (
            <button
              key={item.id}
              id={`aba-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selecionada}
              aria-controls={`painel-${item.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => selecionarAba(item.id)}
              onKeyDown={(event) => aoTeclarAba(event, indice)}
              className={[
                "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium",
                selecionada
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-700 hover:bg-neutral-100",
              ].join(" ")}
            >
              {item.rotulo}
            </button>
          );
        })}
      </div>

      {aba === "visao-geral" ? (
        <section
          role="tabpanel"
          id="painel-visao-geral"
          aria-labelledby="aba-visao-geral"
          tabIndex={0}
          className="space-y-6"
        >
          {editando ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Editar ativo</h2>
              <AtivoEdicaoForm
                ativo={ativo}
                classes={classes}
                onCancelar={() => setEditando(false)}
                onSalvo={(atualizado) => {
                  setAtivo(atualizado);
                  setEditando(false);
                  setAviso("Alterações salvas.");
                }}
                onSessaoExpirada={() => setSessaoExpirada(true)}
              />
            </div>
          ) : (
            <>
              <div>
                <h2 className="mb-3 text-lg font-semibold text-neutral-900">Dados cadastrais</h2>
                <dl className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:grid-cols-2 sm:p-6">
                  <ItemDado rotulo="Ticker" valor={ativo.ticker} />
                  <ItemDado rotulo="Nome" valor={ativo.nome} />
                  <ItemDado rotulo="Classe" valor={ativo.classe.nome} />
                  <ItemDado rotulo="Segmento" valor={ativo.segmento?.nome ?? "Não informado"} />
                  <ItemDado rotulo="CNPJ" valor={formatarCnpj(ativo.cnpj)} />
                  <ItemDado rotulo="Administrador" valor={valorOuNaoInformado(ativo.administrador)} />
                  <ItemDado rotulo="Gestor" valor={valorOuNaoInformado(ativo.gestor)} />
                  <ItemDado rotulo="Fonte de dados" valor={valorOuNaoInformado(ativo.fonteDados)} />
                  <ItemDado rotulo="Status" valor={rotuloStatus(ativo.status)} />
                  <ItemDado rotulo="Cadastrado em" valor={formatarDataHora(ativo.criadoEm)} />
                  <ItemDado rotulo="Atualizado em" valor={formatarDataHora(ativo.atualizadoEm)} />
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Observações
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-900">
                      {valorOuNaoInformado(ativo.observacoes)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold text-neutral-900">Posição e preço</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Preço atual
                    </p>
                    <p className="mt-1 text-base font-semibold text-neutral-900">Indisponível</p>
                    <p className="mt-1 text-sm text-neutral-700">
                      Cotação não coletada na Fase 1. O histórico será habilitado com a RN-030.
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Posição
                    </p>
                    {ativo.posicao === null ? (
                      <>
                        <p className="mt-1 text-base font-semibold text-neutral-900">
                          Sem posição
                        </p>
                        <p className="mt-1 text-sm text-neutral-700">
                          Nenhuma movimentação registrada. A posição aparece após a RN-014.
                        </p>
                      </>
                    ) : (
                      <dl className="mt-1 space-y-1 text-sm text-neutral-900">
                        <div className="flex justify-between gap-3">
                          <dt>Quantidade</dt>
                          <dd>{ativo.posicao.quantidade}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Preço médio</dt>
                          <dd>{ativo.posicao.precoMedio}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

      {aba === "movimentacoes" ? (
        <section role="tabpanel" id="painel-movimentacoes" aria-labelledby="aba-movimentacoes" tabIndex={0}>
          <EmptyState
            title="Disponível em breve"
            description="O histórico de movimentações deste ativo será exibido aqui quando a RN-014 for implementada."
          />
        </section>
      ) : null}

      {aba === "rendimentos" ? (
        <section role="tabpanel" id="painel-rendimentos" aria-labelledby="aba-rendimentos" tabIndex={0}>
          <EmptyState
            title="Disponível em breve"
            description="Os rendimentos acumulados serão exibidos aqui quando a RN-017 for implementada."
          />
        </section>
      ) : null}

      {aba === "precos" ? (
        <section role="tabpanel" id="painel-precos" aria-labelledby="aba-precos" tabIndex={0}>
          <EmptyState
            title="Sem cotação na Fase 1"
            description="Cotação indisponível. Nenhuma coleta de preço foi executada; o histórico com proveniência será habilitado com a RN-030."
          />
        </section>
      ) : null}

      {aba === "ficha-externa" ? (
        <section
          role="tabpanel"
          id="painel-ficha-externa"
          aria-labelledby="aba-ficha-externa"
          tabIndex={0}
        >
          <EmptyState
            title="Ficha externa — Fase 3"
            description={
              <>
                <p>
                  A ficha externa de {ativo.ticker} será habilitada com a pesquisa (RN-029).
                  Este é um placeholder.
                </p>
                <p className="mt-2">
                  <Link
                    href={`/pesquisa/${ativo.ticker}`}
                    aria-disabled="true"
                    tabIndex={-1}
                    onClick={(event) => event.preventDefault()}
                    className="cursor-not-allowed font-medium text-neutral-500 underline"
                  >
                    Abrir ficha externa de {ativo.ticker} (em breve)
                  </Link>
                </p>
              </>
            }
          />
        </section>
      ) : null}

      <Dialog
        open={dialogoStatus}
        title={inativar ? "Inativar ativo" : "Reativar ativo"}
        onClose={() => {
          if (!alterandoStatus) {
            setDialogoStatus(false);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDialogoStatus(false)}
              disabled={alterandoStatus}
            >
              Cancelar
            </Button>
            <Button
              variant={inativar ? "danger" : "primary"}
              onClick={confirmarAlteracaoDeStatus}
              carregando={alterandoStatus}
            >
              {inativar ? "Inativar ativo" : "Reativar ativo"}
            </Button>
          </>
        }
      >
        {inativar ? (
          <p>
            O ativo deixa de aceitar novas movimentações e sai das sugestões, mas o histórico
            permanece preservado. Você pode reativá-lo depois.
          </p>
        ) : (
          <p>O ativo volta a aceitar movimentações e a participar das sugestões.</p>
        )}
      </Dialog>
    </div>
  );
}

function ItemDado({ rotulo, valor }: { readonly rotulo: string; readonly valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</dt>
      <dd className="mt-1 break-words text-sm text-neutral-900">{valor}</dd>
    </div>
  );
}
