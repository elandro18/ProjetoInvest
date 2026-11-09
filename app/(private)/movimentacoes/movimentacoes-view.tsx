"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { SelectField } from "@/src/components/ui/select-field";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TextField } from "@/src/components/ui/text-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
} from "@/src/lib/api-client";
import { CancelarMovimentacaoDialog } from "./cancelar-movimentacao-dialog";
import { NovaMovimentacaoForm } from "./nova-movimentacao-form";
import {
  OPCOES_ORDENACAO,
  OPCOES_TIPO_FILTRO,
  PAGE_SIZE_ATIVOS,
  PAGE_SIZE_PADRAO,
  formatarData,
  formatarInstante,
  formatarMoeda,
  formatarQuantidade,
  lerTraceId,
  movimentacaoCancelada,
  rotuloAtivo,
  rotuloTipo,
  type AtivoOpcaoApi,
  type DirecaoOrdem,
  type ListaAtivosOpcaoApi,
  type ListaMovimentacoesApi,
  type MovimentacaoApi,
  type OrdenacaoMovimentacao,
  type RespostaCancelamentoApi,
  type RespostaCriacaoMovimentacaoApi,
  type TipoMovimentacao,
} from "./movimentacoes-ui";

interface Filtros {
  readonly ativoId: string;
  readonly tipo: TipoMovimentacao | "";
  readonly de: string;
  readonly ate: string;
  readonly incluirCanceladas: boolean;
}

const FILTROS_VAZIOS: Filtros = {
  ativoId: "",
  tipo: "",
  de: "",
  ate: "",
  incluirCanceladas: false,
};

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";

type ColunaOrdenavel = "data" | "valorTotal";

function temAlgumFiltro(filtros: Filtros): boolean {
  return (
    filtros.ativoId !== "" ||
    filtros.tipo !== "" ||
    filtros.de !== "" ||
    filtros.ate !== "" ||
    filtros.incluirCanceladas
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

/**
 * Tela de movimentações (UI_SPEC §7; RN-014 a RN-019, RN-084).
 *
 * Lista filtrável e paginada no servidor, tabela no desktop e cartões abaixo
 * de 768 px (UI_SPEC §19). O formulário calcula o total em tempo real e trata
 * o 409 de posição negativa com confirmação explícita e motivo (RN-018). O
 * cancelamento é lógico: o item permanece na lista com badge de cancelada e a
 * posição devolvida pelo servidor aparece no feedback (RN-084).
 */
export function MovimentacoesView() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<OrdenacaoMovimentacao>("data");
  const [order, setOrder] = useState<DirecaoOrdem>("desc");

  const [resposta, setResposta] = useState<ListaMovimentacoesApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativaLista, setTentativaLista] = useState(0);

  const [ativos, setAtivos] = useState<readonly AtivoOpcaoApi[]>([]);
  const [carregandoAtivos, setCarregandoAtivos] = useState(true);
  const [erroAtivos, setErroAtivos] = useState<string | null>(null);
  const [tentativaAtivos, setTentativaAtivos] = useState(0);

  const [formAberto, setFormAberto] = useState(false);
  const [cancelando, setCancelando] = useState<MovimentacaoApi | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    if (filtros.ativoId !== "") {
      params.set("ativoId", filtros.ativoId);
    }
    if (filtros.tipo !== "") {
      params.set("tipo", filtros.tipo);
    }
    if (filtros.de !== "") {
      params.set("de", filtros.de);
    }
    if (filtros.ate !== "") {
      params.set("ate", filtros.ate);
    }
    params.set("incluirCanceladas", filtros.incluirCanceladas ? "true" : "false");
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE_PADRAO));
    params.set("sort", sort);
    params.set("order", order);

    void (async () => {
      try {
        const resultado = await apiRequest<ListaMovimentacoesApi>(
          `/api/movimentacoes?${params.toString()}`,
          { signal: controller.signal },
        );
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
          "Não foi possível carregar as movimentações. Verifique sua conexão e tente novamente.",
        );
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
        const resultado = await apiRequest<ListaAtivosOpcaoApi>(
          `/api/ativos?status=ATIVO&page=1&pageSize=${PAGE_SIZE_ATIVOS}&sort=ticker&order=asc`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setAtivos(resultado.data.data);
          setErroAtivos(null);
          return;
        }

        setAtivos([]);
        setErroAtivos(mensagemDeErro(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setAtivos([]);
        setErroAtivos("Não foi possível carregar a lista de ativos.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoAtivos(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaAtivos]);

  const itens = resposta?.data ?? [];
  const total = resposta?.meta.total ?? 0;
  const temFiltros = temAlgumFiltro(filtros);

  function iniciarCarregamento() {
    setCarregando(true);
    setErro(null);
    setTraceId(null);
    setSessaoExpirada(false);
  }

  function aplicarFiltro(parcial: Partial<Filtros>) {
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

  function recarregarAtivos() {
    setCarregandoAtivos(true);
    setErroAtivos(null);
    setTentativaAtivos((valor) => valor + 1);
  }

  function ordenarPor(coluna: ColunaOrdenavel) {
    if (sort === coluna) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(coluna);
      setOrder(coluna === "data" ? "desc" : "asc");
    }
    setPage(1);
    iniciarCarregamento();
  }

  function ariaSort(coluna: ColunaOrdenavel): "ascending" | "descending" | "none" {
    if (sort !== coluna) {
      return "none";
    }
    return order === "asc" ? "ascending" : "descending";
  }

  function ordenacaoAtual(): string {
    return `${sort}:${order}`;
  }

  function alterarOrdenacaoMobile(valor: string) {
    const [novoSort, novaOrdem] = valor.split(":") as [OrdenacaoMovimentacao, DirecaoOrdem];
    setSort(novoSort);
    setOrder(novaOrdem);
    setPage(1);
    iniciarCarregamento();
  }

  function irParaPagina(novaPagina: number) {
    setPage(novaPagina);
    iniciarCarregamento();
  }

  function messageDaPosicao(ticker: string, posicao: RespostaCancelamentoApi["posicao"]): string {
    return `Posição de ${ticker}: ${formatarQuantidade(posicao.quantidade)} cotas · preço médio ${formatarMoeda(posicao.precoMedio)}.`;
  }

  function aoCriar(respostaCriacao: RespostaCriacaoMovimentacaoApi) {
    const item = respostaCriacao.movimentacao;
    setFormAberto(false);
    setFeedback(
      `Movimentação registrada: ${rotuloTipo(item.tipo)} de ${item.ativo.ticker} em ${formatarData(item.data)}. ${messageDaPosicao(item.ativo.ticker, respostaCriacao.posicao)}`,
    );
    if (page === 1) {
      setTentativaLista((valor) => valor + 1);
    } else {
      setPage(1);
    }
    iniciarCarregamento();
  }

  function aoCancelar(respostaCancelamento: RespostaCancelamentoApi) {
    const atualizada = respostaCancelamento.movimentacao;
    setCancelando(null);
    setResposta((atual) =>
      atual === null
        ? atual
        : {
            ...atual,
            data: atual.data.map((item) => (item.id === atualizada.id ? atualizada : item)),
          },
    );
    setFeedback(
      `Movimentação cancelada. Ela permanece no histórico (marque "Incluir canceladas" para vê-la em novas consultas). ${messageDaPosicao(atualizada.ativo.ticker, respostaCancelamento.posicao)}`,
    );
  }

  function aoExpirarSessao() {
    setFormAberto(false);
    setCancelando(null);
    setSessaoExpirada(true);
    setErro("Sua sessão expirou. Entre novamente para continuar.");
  }

  function renderizarStatus(item: MovimentacaoApi) {
    if (!movimentacaoCancelada(item)) {
      return <StatusBadge tone="success">Ativa</StatusBadge>;
    }

    const detalhe = item.cancelamentoMotivo === null ? "" : ` Motivo: ${item.cancelamentoMotivo}`;
    return (
      <span title={`Cancelada em ${formatarInstante(item.canceladaEm ?? "")}.${detalhe}`}>
        <StatusBadge tone="neutral">Cancelada</StatusBadge>
        <span className="sr-only"> — cancelada em {formatarInstante(item.canceladaEm ?? "")}</span>
      </span>
    );
  }

  function renderizarAcao(item: MovimentacaoApi) {
    if (movimentacaoCancelada(item)) {
      return <span className="text-xs text-neutral-500">—</span>;
    }

    return (
      <Button
        variant="ghost"
        onClick={() => setCancelando(item)}
        aria-label={`Cancelar movimentação de ${item.ativo.ticker} de ${formatarData(item.data)}`}
      >
        Cancelar
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Movimentações</h1>
          <p className="text-sm text-neutral-700">
            Registre compras, vendas, dividendos e taxas. Cada movimentação atualiza a posição e o
            preço médio do ativo.
          </p>
        </div>
        <Button onClick={() => setFormAberto(true)}>Nova movimentação</Button>
      </div>

      {feedback === null ? null : (
        <Alert
          tone="success"
          title="Tudo certo"
          action={
            <Button variant="ghost" onClick={() => setFeedback(null)}>
              Fechar
            </Button>
          }
        >
          <p>{feedback}</p>
        </Alert>
      )}

      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          recarregarLista();
        }}
        role="search"
        className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            id="filtro-mov-ativo"
            label="Filtrar por ativo"
            name="ativoId"
            value={filtros.ativoId}
            disabled={carregandoAtivos}
            onChange={(event) => aplicarFiltro({ ativoId: event.target.value })}
          >
            <option value="">
              {carregandoAtivos ? "Carregando ativos…" : "Todos os ativos"}
            </option>
            {ativos.map((ativo) => (
              <option key={ativo.id} value={ativo.id}>
                {rotuloAtivo(ativo)}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="filtro-mov-tipo"
            label="Filtrar por tipo"
            name="tipo"
            value={filtros.tipo}
            onChange={(event) =>
              aplicarFiltro({ tipo: event.target.value as TipoMovimentacao | "" })
            }
          >
            <option value="">Todos os tipos</option>
            {OPCOES_TIPO_FILTRO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>

          <TextField
            id="filtro-mov-de"
            label="Data inicial"
            name="de"
            type="date"
            value={filtros.de}
            max={filtros.ate === "" ? undefined : filtros.ate}
            onChange={(event) => aplicarFiltro({ de: event.target.value })}
          />

          <TextField
            id="filtro-mov-ate"
            label="Data final"
            name="ate"
            type="date"
            value={filtros.ate}
            min={filtros.de === "" ? undefined : filtros.de}
            onChange={(event) => aplicarFiltro({ ate: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            label="Incluir canceladas"
            checked={filtros.incluirCanceladas}
            onChange={(event) => aplicarFiltro({ incluirCanceladas: event.target.checked })}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="secondary">
              Atualizar
            </Button>
            {temFiltros ? (
              <Button variant="ghost" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </div>

        {erroAtivos === null ? null : (
          <p role="status" className="text-sm text-warning">
            Lista de ativos indisponível: {erroAtivos}{" "}
            <Button variant="ghost" onClick={recarregarAtivos} className="px-2 py-1">
              Tentar novamente
            </Button>
          </p>
        )}
      </form>

      <div className="flex items-center justify-end gap-2 md:hidden">
        <label htmlFor="ordenacao-movimentacoes" className="text-sm text-neutral-700">
          Ordenar por
        </label>
        <select
          id="ordenacao-movimentacoes"
          value={ordenacaoAtual()}
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
          <span className="sr-only">Carregando movimentações…</span>
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      ) : erro !== null ? (
        <ErrorState
          message={erro}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : recarregarLista}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Fmovimentacoes" className={ESTILO_BOTAO_PRIMARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : itens.length === 0 ? (
        temFiltros ? (
          <EmptyState
            title="Nenhuma movimentação encontrada"
            description={
              filtros.incluirCanceladas
                ? "Nenhuma movimentação corresponde aos filtros atuais."
                : "Nenhuma movimentação corresponde aos filtros atuais. Se o registro foi cancelado, marque \u201cIncluir canceladas\u201d."
            }
            action={
              <Button variant="secondary" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhuma movimentação registrada"
            description="Registre a primeira compra, venda ou provento para começar a acompanhar a posição e o preço médio do ativo."
            action={<Button onClick={() => setFormAberto(true)}>Nova movimentação</Button>}
          />
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block lg:relative lg:left-1/2 lg:w-[calc(100vw-3rem)] lg:max-w-[1216px] lg:-translate-x-1/2">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <caption className="sr-only">
                Movimentações registradas. Use os cabeçalhos para ordenar por data ou valor total.
              </caption>
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th
                    scope="col"
                    aria-sort={ariaSort("data")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("data")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Data
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("data"))}</span>
                      <span className="sr-only">Ordenar por Data</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Ativo
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Tipo
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Quantidade
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Valor unitário
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Custos
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("valorTotal")}
                    className="px-3 py-2 text-right font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("valorTotal")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Valor total
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("valorTotal"))}</span>
                      <span className="sr-only">Ordenar por Valor total</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr
                    key={item.id}
                    className={[
                      "border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50",
                      movimentacaoCancelada(item) ? "text-neutral-500" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="px-3 py-3">{formatarData(item.data)}</td>
                    <td className="px-3 py-3 font-medium text-neutral-900">
                      {item.ativo.ticker}
                    </td>
                    <td className="px-3 py-3">{rotuloTipo(item.tipo)}</td>
                    <td className="px-3 py-3 text-right">
                      {formatarQuantidade(item.quantidade)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {item.valorUnitario === null ? "—" : formatarMoeda(item.valorUnitario)}
                    </td>
                    <td className="px-3 py-3 text-right">{formatarMoeda(item.custos)}</td>
                    <td className="px-3 py-3 text-right font-medium text-neutral-900">
                      {formatarMoeda(item.valorTotal)}
                    </td>
                    <td className="px-3 py-3">{renderizarStatus(item)}</td>
                    <td className="px-3 py-3">{renderizarAcao(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {itens.map((item) => (
              <li key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-0 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-neutral-900">
                      {item.ativo.ticker}
                    </p>
                    <p className="text-sm text-neutral-700">{rotuloTipo(item.tipo)}</p>
                  </div>
                  {renderizarStatus(item)}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Data
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">{formatarData(item.data)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Quantidade
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">
                      {formatarQuantidade(item.quantidade)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Valor unitário
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">
                      {item.valorUnitario === null ? "—" : formatarMoeda(item.valorUnitario)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Custos
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">{formatarMoeda(item.custos)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Valor total
                    </dt>
                    <dd className="mt-0.5 font-semibold text-neutral-900">
                      {formatarMoeda(item.valorTotal)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3">{renderizarAcao(item)}</div>
              </li>
            ))}
          </ul>

          <nav
            aria-label="Paginação de movimentações"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-neutral-700">
              {total} {total === 1 ? "movimentação" : "movimentações"} · Página{" "}
              {resposta?.meta.page ?? 1} de {Math.max(resposta?.meta.totalPages ?? 1, 1)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={(resposta?.meta.page ?? 1) <= 1}
                onClick={() => irParaPagina(Math.max(1, (resposta?.meta.page ?? 1) - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={(resposta?.meta.page ?? 1) >= (resposta?.meta.totalPages ?? 1)}
                onClick={() => irParaPagina((resposta?.meta.page ?? 1) + 1)}
              >
                Próxima
              </Button>
            </div>
          </nav>
        </>
      )}

      {formAberto ? (
        <NovaMovimentacaoForm
          aberto={formAberto}
          ativos={ativos}
          carregandoAtivos={carregandoAtivos}
          erroAtivos={erroAtivos}
          onRecarregarAtivos={recarregarAtivos}
          onFechar={() => setFormAberto(false)}
          onCriada={aoCriar}
          onSessaoExpirada={aoExpirarSessao}
        />
      ) : null}

      {cancelando === null ? null : (
        <CancelarMovimentacaoDialog
          key={cancelando.id}
          movimentacao={cancelando}
          onFechar={() => setCancelando(null)}
          onCancelada={aoCancelar}
          onSessaoExpirada={aoExpirarSessao}
        />
      )}
    </div>
  );
}
