"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { SelectField } from "@/src/components/ui/select-field";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TextField } from "@/src/components/ui/text-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import {
  BUSCA_MAX,
  OPCOES_ORDENACAO,
  OPCOES_STATUS,
  TAMANHO_PAGINA,
  TONS_STATUS,
  rotuloStatus,
  type ClasseReferenciaApi,
  type DirecaoOrdem,
  type ListaAtivosApi,
  type OrdenacaoAtivo,
  type ReferenciaAtivosApi,
  type StatusAtivo,
} from "./ativos-ui";

interface Filtros {
  readonly q: string;
  readonly classeId: string;
  readonly segmentoId: string;
  readonly status: string;
}

const FILTROS_VAZIOS: Filtros = { q: "", classeId: "", segmentoId: "", status: "" };

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";

export interface AtivosListaProps {
  /** Ticker recém-cadastrado, lido de `?criado=` pelo servidor (feedback). */
  readonly feedback?: string | null;
}

function temAlgumFiltro(filtros: Filtros): boolean {
  return (
    filtros.q !== "" ||
    filtros.classeId !== "" ||
    filtros.segmentoId !== "" ||
    filtros.status !== ""
  );
}

/**
 * Listagem de ativos (UI_SPEC §6.1, RN-010-4).
 *
 * Tabela no desktop e cartões abaixo de 768 px (UI_SPEC §19); busca e filtros
 * ficam na mesma faixa para não deslocar o conteúdo ao carregar. O estado de
 * erro mantém os filtros utilizáveis e oferece retry (UI_SPEC §17).
 */
export function AtivosLista({ feedback = null }: AtivosListaProps) {
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<OrdenacaoAtivo>("ticker");
  const [order, setOrder] = useState<DirecaoOrdem>("asc");

  const [resposta, setResposta] = useState<ListaAtivosApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativaLista, setTentativaLista] = useState(0);

  const [referencia, setReferencia] = useState<ReferenciaAtivosApi | null>(null);
  const [erroReferencia, setErroReferencia] = useState(false);
  const [tentativaReferencia, setTentativaReferencia] = useState(0);

  const [mostrarFeedback, setMostrarFeedback] = useState(feedback !== null);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    if (filtros.q !== "") {
      params.set("q", filtros.q);
    }
    if (filtros.classeId !== "") {
      params.set("classeId", filtros.classeId);
    }
    if (filtros.segmentoId !== "") {
      params.set("segmentoId", filtros.segmentoId);
    }
    if (filtros.status !== "") {
      params.set("status", filtros.status);
    }
    params.set("page", String(page));
    params.set("pageSize", String(TAMANHO_PAGINA));
    params.set("sort", sort);
    params.set("order", order);

    void (async () => {
      try {
        const resultado = await apiRequest<ListaAtivosApi>(`/api/ativos?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setResposta(resultado.data);
          return;
        }

        setResposta(null);
        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
          setErro(resultado.error.message);
          return;
        }
        setErro(mensagemDeErro(resultado.error));
        setTraceId(lerTraceId(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setResposta(null);
        setErro("Não foi possível carregar os ativos. Verifique sua conexão e tente novamente.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [filtros, page, sort, order, tentativaLista]);

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
  }, [tentativaReferencia]);

  const classes: readonly ClasseReferenciaApi[] = referencia?.classes ?? [];
  const classeSelecionada = classes.find((classe) => classe.id === filtros.classeId) ?? null;
  const segmentosDisponiveis = classeSelecionada?.segmentos ?? [];
  const temFiltros = temAlgumFiltro(filtros);
  const total = resposta?.meta.total ?? 0;

  function iniciarCarregamento() {
    setCarregando(true);
    setErro(null);
    setTraceId(null);
    setSessaoExpirada(false);
  }

  function aplicarFiltro(patch: Partial<Filtros>) {
    setFiltros((atual) => ({ ...atual, ...patch }));
    setPage(1);
    iniciarCarregamento();
  }

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    aplicarFiltro({ q: busca.trim() });
  }

  function limparFiltros() {
    setBusca("");
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
    iniciarCarregamento();
  }

  function ordenarPor(coluna: OrdenacaoAtivo) {
    if (sort === coluna) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(coluna);
      setOrder("asc");
    }
    setPage(1);
    iniciarCarregamento();
  }

  function ariaSort(coluna: OrdenacaoAtivo): "ascending" | "descending" | "none" {
    if (sort !== coluna) {
      return "none";
    }
    return order === "asc" ? "ascending" : "descending";
  }

  function tentarNovamente() {
    iniciarCarregamento();
    setTentativaLista((valor) => valor + 1);
  }

  function irParaPagina(novaPagina: number) {
    setPage(novaPagina);
    iniciarCarregamento();
  }

  function alterarOrdenacaoMobile(valor: string) {
    const [novoSort, novaOrdem] = valor.split(":") as [OrdenacaoAtivo, DirecaoOrdem];
    setSort(novoSort);
    setOrder(novaOrdem);
    setPage(1);
    iniciarCarregamento();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Ativos</h1>
          <p className="text-sm text-neutral-700">
            Cadastre e consulte os ativos que compõem seus investimentos.
          </p>
        </div>
        <Link href="/ativos/novo" className={ESTILO_BOTAO_PRIMARIO}>
          Novo ativo
        </Link>
      </div>

      {!mostrarFeedback || feedback === null ? null : (
        <Alert
          tone="success"
          title="Ativo cadastrado"
          action={
            <Button variant="ghost" onClick={() => setMostrarFeedback(false)}>
              Fechar
            </Button>
          }
        >
          <p>
            <strong>{feedback}</strong> foi cadastrado. Abra a ficha para editar ou inativar o
            ativo.
          </p>
        </Alert>
      )}

      <form
        onSubmit={buscar}
        role="search"
        className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Buscar por ticker ou nome"
            type="search"
            name="q"
            placeholder="Ex.: HGLG11"
            maxLength={BUSCA_MAX}
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />

          <SelectField
            label="Classe"
            value={filtros.classeId}
            disabled={referencia === null}
            onChange={(event) => {
              const classeId = event.target.value;
              aplicarFiltro({ classeId, segmentoId: "" });
            }}
          >
            <option value="">Todas as classes</option>
            {classes.map((classe) => (
              <option key={classe.id} value={classe.id}>
                {classe.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Segmento"
            value={filtros.segmentoId}
            disabled={segmentosDisponiveis.length === 0}
            hint={
              segmentosDisponiveis.length === 0
                ? "Selecione uma classe com segmentos para filtrar."
                : undefined
            }
            onChange={(event) => aplicarFiltro({ segmentoId: event.target.value })}
          >
            <option value="">Todos os segmentos</option>
            {segmentosDisponiveis.map((segmento) => (
              <option key={segmento.id} value={segmento.id}>
                {segmento.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filtros.status}
            onChange={(event) => aplicarFiltro({ status: event.target.value as StatusAtivo | "" })}
          >
            <option value="">Todos os status</option>
            {OPCOES_STATUS.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
          {temFiltros ? (
            <Button variant="ghost" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </form>

      {!erroReferencia || referencia !== null ? null : (
        <Alert
          tone="warning"
          title="Filtros de classe e segmento indisponíveis"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setErroReferencia(false);
                setTentativaReferencia((valor) => valor + 1);
              }}
            >
              Tentar novamente
            </Button>
          }
        >
          <p>
            O catálogo de classes não carregou. A lista e a busca por ticker/nome continuam
            disponíveis.
          </p>
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2 md:hidden">
        <label htmlFor="ordenacao-ativos" className="text-sm text-neutral-700">
          Ordenar por
        </label>
        <select
          id="ordenacao-ativos"
          value={`${sort}:${order}`}
          onChange={(event) => alterarOrdenacaoMobile(event.target.value)}
          className="rounded-lg border border-neutral-200 bg-neutral-0 px-2 py-1.5 text-sm text-neutral-900"
        >
          {OPCOES_ORDENACAO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </div>

      {carregando ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Carregando ativos…</span>
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      ) : erro !== null ? (
        <ErrorState
          message={erro}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : tentarNovamente}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Fativos" className={ESTILO_BOTAO_PRIMARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : resposta === null || resposta.data.length === 0 ? (
        temFiltros ? (
          <EmptyState
            title="Nenhum ativo encontrado"
            description="Nenhum ativo corresponde à busca e aos filtros atuais."
            action={
              <Button variant="secondary" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhum ativo cadastrado"
            description="Cadastre o primeiro ativo para começar a acompanhar posições, movimentações e rendimentos."
            action={
              <Link href="/ativos/novo" className={ESTILO_BOTAO_PRIMARIO}>
                Cadastrar primeiro ativo
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">
                Ativos cadastrados. Use os cabeçalhos para ordenar por ticker, nome ou status.
              </caption>
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th
                    scope="col"
                    aria-sort={ariaSort("ticker")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("ticker")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Ticker
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("ticker"))}</span>
                      <span className="sr-only">Ordenar por Ticker</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("nome")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("nome")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Nome
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("nome"))}</span>
                      <span className="sr-only">Ordenar por Nome</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Classe
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Segmento
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("status")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("status")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Status
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("status"))}</span>
                      <span className="sr-only">Ordenar por Status</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {resposta.data.map((ativo) => (
                  <tr
                    key={ativo.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50"
                  >
                    <td className="px-3 py-3 font-medium text-neutral-900">
                      <Link
                        href={`/ativos/${ativo.id}`}
                        className="text-info hover:underline"
                        aria-label={`Abrir ficha de ${ativo.ticker}`}
                      >
                        {ativo.ticker}
                      </Link>
                    </td>
                    <td className="max-w-56 truncate px-3 py-3 text-neutral-900" title={ativo.nome}>
                      {ativo.nome}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">{ativo.classe.nome}</td>
                    <td className="px-3 py-3 text-neutral-700">
                      {ativo.segmento?.nome ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={TONS_STATUS[ativo.status]}>
                        {rotuloStatus(ativo.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/ativos/${ativo.id}`}
                        className="text-sm font-medium text-info hover:underline"
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {resposta.data.map((ativo) => (
              <li
                key={ativo.id}
                className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{ativo.ticker}</p>
                    <p className="break-words text-sm text-neutral-700">{ativo.nome}</p>
                  </div>
                  <StatusBadge tone={TONS_STATUS[ativo.status]}>
                    {rotuloStatus(ativo.status)}
                  </StatusBadge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Classe
                    </dt>
                    <dd className="mt-0.5 break-words text-neutral-900">{ativo.classe.nome}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Segmento
                    </dt>
                    <dd className="mt-0.5 break-words text-neutral-900">
                      {ativo.segmento?.nome ?? "—"}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/ativos/${ativo.id}`}
                  className="mt-3 inline-flex text-sm font-medium text-info hover:underline"
                  aria-label={`Abrir ficha de ${ativo.ticker}`}
                >
                  Abrir ficha
                </Link>
              </li>
            ))}
          </ul>

          <nav
            aria-label="Paginação de ativos"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-neutral-700">
              {total} {total === 1 ? "ativo" : "ativos"} · Página {resposta.meta.page} de{" "}
              {Math.max(resposta.meta.totalPages, 1)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={resposta.meta.page <= 1}
                onClick={() => irParaPagina(Math.max(1, resposta.meta.page - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={resposta.meta.page >= resposta.meta.totalPages}
                onClick={() => irParaPagina(resposta.meta.page + 1)}
              >
                Próxima
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function simboloOrdenacao(direcao: "ascending" | "descending" | "none"): string {
  if (direcao === "ascending") {
    return "▲";
  }
  if (direcao === "descending") {
    return "▼";
  }
  return "↕";
}

function lerTraceId(error: ApiError): string | null {
  const valor = error.details?.traceId;
  return typeof valor === "string" ? valor : null;
}
