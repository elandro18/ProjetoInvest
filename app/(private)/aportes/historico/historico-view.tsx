"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { SelectField } from "@/src/components/ui/select-field";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TextField } from "@/src/components/ui/text-field";
import { apiRequest, ehErroDeSessao, mensagemDeErro, type ApiError } from "@/src/lib/api-client";
import type {
  SugestaoDetalheApi,
  SugestaoHistoricoItemApi,
} from "@/src/modules/aportes/apresentacao";

import { ESTILO_LINK_BOTAO, formatarDataHora, formatarMoeda } from "../aportes-ui";
import { DetalheSugestao, ID_FOCO_DETALHE } from "./historico-detalhe";
import {
  FILTROS_VAZIOS,
  OPCOES_DECISAO_FILTRO,
  consultaHistorico,
  ehSugestaoNaoEncontrada,
  resumoPorClasse,
  rotuloDecisaoHistorico,
  temFiltroHistorico,
  type FiltrosHistorico,
  type ListaHistoricoApi,
} from "./historico-ui";

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

interface ErroDetalhe {
  readonly naoEncontrado: boolean;
  readonly sessaoExpirada: boolean;
  readonly mensagem: string;
  readonly traceId: string | null;
}

// ---------------------------------------------------------------------------
// Lista: resumo por classe
// ---------------------------------------------------------------------------

function ResumoClasse({ item }: { readonly item: SugestaoHistoricoItemApi }) {
  const linhas = resumoPorClasse(item.resumo);

  if (linhas.length === 0) {
    return <span className="text-neutral-500">Sem distribuição registrada</span>;
  }

  return (
    <ul aria-label="Resumo por classe" className="space-y-0.5">
      {linhas.map((linha) => (
        <li key={linha.codigo} className="break-words">
          <span className="text-neutral-700">{linha.rotulo}</span>
          <span aria-hidden="true" className="text-neutral-500">
            {" · "}
          </span>
          <span className="font-medium text-neutral-900">{formatarMoeda(linha.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/**
 * Histórico de sugestões (UI_SPEC §10.1; RN-052).
 *
 * Somente leitura: lista paginada com filtros de período e decisão, e o
 * snapshot completo em diálogo. Nenhuma ação de decisão existe aqui — a
 * decisão é registrada em `/aportes` (RN-053).
 *
 * Cada linha mostra a decisão registrada ou "Sem decisão": sugestão sem
 * decisão continua no histórico e não pode parecer decidida.
 */
export function HistoricoView() {
  const [filtros, setFiltros] = useState<FiltrosHistorico>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);
  const [tentativaLista, setTentativaLista] = useState(0);

  const [resposta, setResposta] = useState<ListaHistoricoApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<SugestaoDetalheApi | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<ErroDetalhe | null>(null);
  const [tentativaDetalhe, setTentativaDetalhe] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<ListaHistoricoApi>(consultaHistorico(filtros, page), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setResposta(resultado.data);
          setErro(null);
          setTraceId(null);
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
        setErro(
          "Não foi possível carregar o histórico. Verifique sua conexão e tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [filtros, page, tentativaLista]);

  useEffect(() => {
    if (detalheId === null) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<SugestaoDetalheApi>(`/api/aportes/${detalheId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setDetalhe(resultado.data);
          setErroDetalhe(null);
          return;
        }

        const naoEncontrado = ehSugestaoNaoEncontrada(resultado.status, resultado.error.code);
        setDetalhe(null);
        setErroDetalhe({
          naoEncontrado,
          sessaoExpirada: !naoEncontrado && ehErroDeSessao(resultado.error),
          mensagem: naoEncontrado
            ? "Esta sugestão não existe ou não pertence à sua conta."
            : mensagemDeErro(resultado.error),
          traceId: lerTraceId(resultado.error),
        });
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setDetalhe(null);
        setErroDetalhe({
          naoEncontrado: false,
          sessaoExpirada: false,
          mensagem: "Não foi possível carregar o detalhe. Verifique sua conexão e tente novamente.",
          traceId: null,
        });
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoDetalhe(false);
        }
      }
    })();

    return () => controller.abort();
  }, [detalheId, tentativaDetalhe]);

  useEffect(() => {
    if (detalhe !== null) {
      document.getElementById(ID_FOCO_DETALHE)?.focus();
    }
  }, [detalhe]);

  const itens = resposta?.data ?? [];
  const total = resposta?.meta.total ?? 0;
  const paginaAtual = resposta?.meta.page ?? page;
  const totalPaginas = Math.max(resposta?.meta.totalPages ?? 1, 1);
  const temFiltros = temFiltroHistorico(filtros);

  function iniciarCarregamento() {
    setCarregando(true);
    setErro(null);
    setTraceId(null);
    setSessaoExpirada(false);
  }

  function aplicarFiltro(parcial: Partial<FiltrosHistorico>) {
    setFiltros({ ...filtros, ...parcial });
    setPage(1);
    iniciarCarregamento();
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
    iniciarCarregamento();
  }

  function recarregarLista() {
    iniciarCarregamento();
    setTentativaLista((valor) => valor + 1);
  }

  function irParaPagina(novaPagina: number) {
    setPage(novaPagina);
    iniciarCarregamento();
  }

  function abrirDetalhe(id: string) {
    setDetalhe(null);
    setErroDetalhe(null);
    setCarregandoDetalhe(true);
    setDetalheId(id);
  }

  function fecharDetalhe() {
    setDetalheId(null);
    setDetalhe(null);
    setErroDetalhe(null);
    setCarregandoDetalhe(false);
  }

  function tentarDetalheNovamente() {
    setDetalhe(null);
    setErroDetalhe(null);
    setCarregandoDetalhe(true);
    setTentativaDetalhe((valor) => valor + 1);
  }

  function botaoDetalhe(
    item: SugestaoHistoricoItemApi,
    variante: "ghost" | "secondary" = "ghost",
    larguraTotal = false,
  ) {
    return (
      <Button
        variant={variante}
        larguraTotal={larguraTotal}
        aria-label={`Ver detalhe da sugestão de ${formatarDataHora(item.data)}`}
        onClick={() => abrirDetalhe(item.id)}
      >
        Ver detalhe
      </Button>
    );
  }

  function statusDecisao(item: SugestaoHistoricoItemApi) {
    const decisao = rotuloDecisaoHistorico(item.decisaoUsuario);

    if (item.decisaoEm === null) {
      return (
        <span title="Nenhuma decisão foi registrada para esta sugestão.">
          <StatusBadge tone={decisao.tone}>{decisao.texto}</StatusBadge>
        </span>
      );
    }

    return (
      <span title={`Decisão registrada em ${formatarDataHora(item.decisaoEm)}`}>
        <StatusBadge tone={decisao.tone}>{decisao.texto}</StatusBadge>
        <span className="sr-only"> — registrada em {formatarDataHora(item.decisaoEm)}</span>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Histórico de sugestões</h1>
          <p className="text-sm text-neutral-700">
            Consulte as sugestões de distribuição que você já gerou e a decisão registrada em cada
            uma. O histórico é somente leitura.
          </p>
        </div>
        <Link href="/aportes" className={`${ESTILO_LINK_BOTAO} ml-auto`}>
          Voltar para Aportes
        </Link>
      </div>

      <form
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          recarregarLista();
        }}
        className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            id="filtro-historico-de"
            label="Período — de"
            name="de"
            type="date"
            value={filtros.de}
            max={filtros.ate === "" ? undefined : filtros.ate}
            onChange={(evento) => aplicarFiltro({ de: evento.target.value })}
          />

          <TextField
            id="filtro-historico-ate"
            label="Período — até"
            name="ate"
            type="date"
            value={filtros.ate}
            min={filtros.de === "" ? undefined : filtros.de}
            onChange={(evento) => aplicarFiltro({ ate: evento.target.value })}
          />

          <SelectField
            id="filtro-historico-decisao"
            label="Decisão"
            name="decisao"
            value={filtros.decisao}
            onChange={(evento) =>
              aplicarFiltro({ decisao: evento.target.value as FiltrosHistorico["decisao"] })
            }
          >
            {OPCOES_DECISAO_FILTRO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="submit" variant="secondary">
            Atualizar
          </Button>
          {temFiltros ? (
            <Button variant="ghost" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </form>

      {carregando ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Carregando o histórico de sugestões…</span>
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      ) : erro !== null ? (
        <ErrorState
          title="Não foi possível carregar o histórico"
          message={erro}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : recarregarLista}
          action={
            sessaoExpirada ? (
              <Link
                href="/login?callbackUrl=%2Faportes%2Fhistorico"
                className={ESTILO_BOTAO_PRIMARIO}
              >
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : itens.length === 0 ? (
        temFiltros ? (
          <EmptyState
            title="Nenhuma sugestão no período"
            description="Nenhuma sugestão corresponde aos filtros atuais. Ajuste o período ou a decisão e tente novamente."
            action={
              <Button variant="secondary" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhuma sugestão registrada"
            description="Gere uma sugestão de distribuição em Aportes para que ela apareça aqui, com a decisão que você registrar."
            action={
              <Link href="/aportes" className={ESTILO_BOTAO_PRIMARIO}>
                Ir para Aportes
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">
                Sugestões de distribuição do seu histórico, da mais recente para a mais antiga, com
                decisão e resumo por classe.
              </caption>
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th
                    scope="col"
                    aria-sort="descending"
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    Data
                    <span className="sr-only"> (ordenado da mais recente para a mais antiga)</span>
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Valor
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Decisão
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Resumo por classe
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    <span className="sr-only">Detalhe</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-200 align-top last:border-b-0 hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-3 py-3 text-neutral-900">
                      {formatarDataHora(item.data)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-neutral-900">
                      {formatarMoeda(item.valorDisponivel)}
                    </td>
                    <td className="px-3 py-3">{statusDecisao(item)}</td>
                    <td className="px-3 py-3">
                      <ResumoClasse item={item} />
                    </td>
                    <td className="px-3 py-3 text-right">{botaoDetalhe(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {itens.map((item) => (
              <li key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-0 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-neutral-900">
                      {formatarMoeda(item.valorDisponivel)}
                    </p>
                    <p className="text-sm text-neutral-700">{formatarDataHora(item.data)}</p>
                  </div>
                  {statusDecisao(item)}
                </div>

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Resumo por classe
                  </p>
                  <div className="mt-1">
                    <ResumoClasse item={item} />
                  </div>
                </div>

                <div className="mt-3">{botaoDetalhe(item, "secondary", true)}</div>
              </li>
            ))}
          </ul>

          <nav
            aria-label="Paginação do histórico de sugestões"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-neutral-700">
              {`${total} ${total === 1 ? "sugestão" : "sugestões"} · Página ${paginaAtual} de ${totalPaginas}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={paginaAtual <= 1}
                onClick={() => irParaPagina(Math.max(1, paginaAtual - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => irParaPagina(paginaAtual + 1)}
              >
                Próxima
              </Button>
            </div>
          </nav>
        </>
      )}

      <Dialog
        open={detalheId !== null}
        title="Detalhe da sugestão"
        size="lg"
        initialFocusId={ID_FOCO_DETALHE}
        onClose={fecharDetalhe}
        footer={
          <Button variant="secondary" onClick={fecharDetalhe}>
            Fechar
          </Button>
        }
      >
        {carregandoDetalhe ? (
          <div aria-busy="true" className="space-y-3">
            <span className="sr-only">Carregando o detalhe da sugestão…</span>
            <div className="h-8 w-2/3 animate-pulse rounded-lg bg-neutral-200" />
            <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
            <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
          </div>
        ) : erroDetalhe === null ? null : erroDetalhe.naoEncontrado ? (
          <Alert tone="error" title="Sugestão não encontrada">
            <p>{erroDetalhe.mensagem}</p>
            <p className="text-neutral-700">
              Volte ao histórico e escolha outra sugestão da lista.
            </p>
          </Alert>
        ) : (
          <ErrorState
            title="Não foi possível carregar o detalhe"
            message={erroDetalhe.mensagem}
            traceId={erroDetalhe.traceId}
            onRetry={erroDetalhe.sessaoExpirada ? undefined : tentarDetalheNovamente}
            action={
              erroDetalhe.sessaoExpirada ? (
                <Link
                  href="/login?callbackUrl=%2Faportes%2Fhistorico"
                  className={ESTILO_BOTAO_PRIMARIO}
                >
                  Entrar novamente
                </Link>
              ) : undefined
            }
          />
        )}

        {detalhe === null ? null : <DetalheSugestao sugestao={detalhe} />}
      </Dialog>
    </div>
  );
}
