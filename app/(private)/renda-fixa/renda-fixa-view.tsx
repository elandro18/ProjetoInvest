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
import { AtualizarSaldoDialog } from "./atualizar-saldo-dialog";
import { RendaFixaForm } from "./renda-fixa-form";
import {
  OPCOES_ORDENACAO,
  OPCOES_PRODUTO,
  PAGE_SIZE_MAXIMO,
  PAGE_SIZE_PADRAO,
  TONS_SEVERIDADE,
  TONS_STATUS_SALDO,
  agruparAlertasPorTitulo,
  alertaMaisSevero,
  contarAlertas,
  formatarData,
  formatarMoeda,
  formatarPercentual,
  lerTraceId,
  rotuloIndexador,
  rotuloLiquidez,
  rotuloProduto,
  rotuloSeveridade,
  rotuloStatusSaldo,
  rotuloTipoAlerta,
  type AlertaRendaFixa,
  type DirecaoOrdem,
  type ListaRendaFixaApi,
  type OrdenacaoRendaFixa,
  type ProdutoRendaFixa,
  type RendaFixaApi,
  type RespostaAlertasApi,
} from "./renda-fixa-ui";

interface Filtros {
  readonly instituicao: string;
  readonly produto: ProdutoRendaFixa | "";
  readonly vencimentoAte: string;
}

const FILTROS_VAZIOS: Filtros = { instituicao: "", produto: "", vencimentoAte: "" };

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";

type ColunaOrdenavel =
  | "instituicao"
  | "produto"
  | "dataAplicacao"
  | "vencimento"
  | "saldoAtual";

function temAlgumFiltro(filtros: Filtros, somenteComAlerta: boolean): boolean {
  return (
    filtros.instituicao !== "" ||
    filtros.produto !== "" ||
    filtros.vencimentoAte !== "" ||
    somenteComAlerta
  );
}

/**
 * Tela de renda fixa (UI_SPEC §8; RN-057 a RN-059).
 *
 * Lista com filtros e ordenação no servidor, cartões abaixo de 768 px
 * (UI_SPEC §19) e faixa de alertas calculados sob demanda (RN-058). O filtro
 * "somente com alerta" usa os IDs devolvidos por `/api/renda-fixa/alertas`
 * (não existe parâmetro de API para isso): nesse modo a consulta pede o teto
 * de 100 itens do contrato e a paginação é suspensa, para o recorte ser
 * consistente com a contagem exibida.
 */
export function RendaFixaView() {
  const [instituicaoDraft, setInstituicaoDraft] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [somenteComAlerta, setSomenteComAlerta] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<OrdenacaoRendaFixa>("vencimento");
  const [order, setOrder] = useState<DirecaoOrdem>("asc");

  const [resposta, setResposta] = useState<ListaRendaFixaApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativaLista, setTentativaLista] = useState(0);

  const [alertas, setAlertas] = useState<readonly AlertaRendaFixa[]>([]);
  const [carregandoAlertas, setCarregandoAlertas] = useState(true);
  const [erroAlertas, setErroAlertas] = useState<string | null>(null);
  const [tentativaAlertas, setTentativaAlertas] = useState(0);

  const [formAberto, setFormAberto] = useState(false);
  const [tituloParaSaldo, setTituloParaSaldo] = useState<RendaFixaApi | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    if (filtros.instituicao !== "") {
      params.set("instituicao", filtros.instituicao);
    }
    if (filtros.produto !== "") {
      params.set("produto", filtros.produto);
    }
    if (filtros.vencimentoAte !== "") {
      params.set("vencimentoAte", filtros.vencimentoAte);
    }
    params.set("page", String(somenteComAlerta ? 1 : page));
    params.set(
      "pageSize",
      String(somenteComAlerta ? PAGE_SIZE_MAXIMO : PAGE_SIZE_PADRAO),
    );
    params.set("sort", sort);
    params.set("order", order);

    void (async () => {
      try {
        const resultado = await apiRequest<ListaRendaFixaApi>(
          `/api/renda-fixa?${params.toString()}`,
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
          "Não foi possível carregar os títulos de renda fixa. Verifique sua conexão e tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [filtros, page, sort, order, somenteComAlerta, tentativaLista]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<RespostaAlertasApi>("/api/renda-fixa/alertas", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setAlertas(resultado.data.alertas);
          setErroAlertas(null);
          return;
        }

        setAlertas([]);
        setErroAlertas(mensagemDeErro(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setAlertas([]);
        setErroAlertas("Não foi possível carregar os alertas.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoAlertas(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaAlertas]);

  const alertasPorTitulo = agruparAlertasPorTitulo(alertas);
  const contagem = contarAlertas(alertas);
  const temFiltros = temAlgumFiltro(filtros, somenteComAlerta);
  const total = resposta?.meta.total ?? 0;
  /**
   * Sem os alertas não há como recortar por ID; nesse caso a lista completa é
   * exibida e a faixa superior já avisa que os alertas estão indisponíveis —
   * melhor do que esconder títulos sem explicar o motivo.
   */
  const recortePorAlertaIndisponivel = somenteComAlerta && erroAlertas !== null;
  const itensVisiveis = (resposta?.data ?? []).filter(
    (item) =>
      !somenteComAlerta || recortePorAlertaIndisponivel || alertasPorTitulo.has(item.id),
  );

  function iniciarCarregamento() {
    setCarregando(true);
    setErro(null);
    setTraceId(null);
    setSessaoExpirada(false);
  }

  function aplicarFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltros({ ...filtros, instituicao: instituicaoDraft.trim() });
    setPage(1);
    iniciarCarregamento();
  }

  function trocarProdutoFiltro(valor: ProdutoRendaFixa | "") {
    setFiltros({ ...filtros, produto: valor });
    setPage(1);
    iniciarCarregamento();
  }

  function trocarVencimentoFiltro(valor: string) {
    setFiltros({ ...filtros, vencimentoAte: valor });
    setPage(1);
    iniciarCarregamento();
  }

  function alternarSomenteComAlerta(ativo: boolean) {
    setSomenteComAlerta(ativo);
    setPage(1);
    iniciarCarregamento();
  }

  function limparFiltros() {
    setInstituicaoDraft("");
    setFiltros(FILTROS_VAZIOS);
    setSomenteComAlerta(false);
    setPage(1);
    iniciarCarregamento();
  }

  function ordenarPor(coluna: ColunaOrdenavel) {
    if (sort === coluna) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(coluna);
      setOrder("asc");
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
    const [novoSort, novaOrdem] = valor.split(":") as [OrdenacaoRendaFixa, DirecaoOrdem];
    setSort(novoSort);
    setOrder(novaOrdem);
    setPage(1);
    iniciarCarregamento();
  }

  function tentarNovamenteLista() {
    iniciarCarregamento();
    setTentativaLista((valor) => valor + 1);
  }

  function tentarNovamenteAlertas() {
    setCarregandoAlertas(true);
    setErroAlertas(null);
    setTentativaAlertas((valor) => valor + 1);
  }

  function irParaPagina(novaPagina: number) {
    setPage(novaPagina);
    iniciarCarregamento();
  }

  function aoCriar(titulo: RendaFixaApi) {
    setFormAberto(false);
    setFeedback(`Título cadastrado: ${rotuloProduto(titulo.produto)} em ${titulo.instituicao}.`);
    setPage(1);
    setTentativaLista((valor) => valor + 1);
    setTentativaAlertas((valor) => valor + 1);
  }

  function aoAtualizarSaldo(atualizado: RendaFixaApi) {
    setTituloParaSaldo(null);
    setFeedback("Saldo atualizado.");
    setResposta((atual) =>
      atual === null
        ? atual
        : {
            ...atual,
            data: atual.data.map((item) => (item.id === atualizado.id ? atualizado : item)),
          },
    );
    setTentativaAlertas((valor) => valor + 1);
  }

  function aoExpirarSessao() {
    setFormAberto(false);
    setTituloParaSaldo(null);
    setSessaoExpirada(true);
    setErro("Sua sessão expirou. Entre novamente para continuar.");
  }

  function alertasDoTitulo(item: RendaFixaApi): readonly AlertaRendaFixa[] {
    return alertasPorTitulo.get(item.id) ?? [];
  }

  function renderizarMarcadorDeAlerta(item: RendaFixaApi) {
    const lista = alertasDoTitulo(item);
    const principal = alertaMaisSevero(lista);

    if (principal === null) {
      return <span className="text-sm text-neutral-500">Sem alerta</span>;
    }

    const mensagens = lista.map((alerta) => alerta.mensagem).join(" ");
    return (
      <span title={mensagens}>
        <StatusBadge tone={TONS_SEVERIDADE[principal.severidade]}>
          {rotuloTipoAlerta(principal.tipo)}
          {lista.length > 1 ? ` +${lista.length - 1}` : ""}
        </StatusBadge>
        <span className="sr-only"> — {mensagens}</span>
      </span>
    );
  }

  function renderizarStatusSaldo(item: RendaFixaApi) {
    return (
      <span
        title={
          item.statusSaldo === "ESTIMADO" ? "Estimado — não é valor oficial" : undefined
        }
      >
        <StatusBadge tone={TONS_STATUS_SALDO[item.statusSaldo]}>
          {rotuloStatusSaldo(item.statusSaldo)}
        </StatusBadge>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Renda fixa</h1>
          <p className="text-sm text-neutral-700">
            Controle títulos, saldos, vencimentos e liquidez. O saldo é informado por você e o
            sistema não calcula rendimento nesta fase.
          </p>
        </div>
        <Button onClick={() => setFormAberto(true)}>Cadastrar título</Button>
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

      <section
        aria-labelledby="rf-alertas-titulo"
        className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rf-alertas-titulo" className="text-base font-semibold text-neutral-900">
            Alertas
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="error">{`Crítico: ${contagem.CRITICO}`}</StatusBadge>
            <StatusBadge tone="warning">{`Atenção: ${contagem.ATENCAO}`}</StatusBadge>
            <StatusBadge tone="info">{`Informação: ${contagem.INFO}`}</StatusBadge>
          </div>
        </div>

        {carregandoAlertas ? (
          <p className="text-sm text-neutral-700" aria-busy="true">
            Carregando alertas…
          </p>
        ) : erroAlertas !== null ? (
          <Alert
            tone="warning"
            title="Alertas indisponíveis"
            action={
              <Button variant="secondary" onClick={tentarNovamenteAlertas}>
                Tentar novamente
              </Button>
            }
          >
            <p>{erroAlertas} A lista de títulos continua disponível.</p>
          </Alert>
        ) : alertas.length === 0 ? (
          <p className="text-sm text-neutral-700">Nenhum alerta ativo no momento.</p>
        ) : (
          <ul className="space-y-2">
            {alertas.map((alerta, indice) => (
              <li
                key={`${alerta.tipo}-${alerta.tituloFixoId}-${indice}`}
                className="flex flex-wrap items-start gap-2 text-sm"
              >
                <StatusBadge tone={TONS_SEVERIDADE[alerta.severidade]}>
                  {rotuloSeveridade(alerta.severidade)}
                </StatusBadge>
                <span className="text-neutral-900">{alerta.mensagem}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={aplicarFiltros}
        role="search"
        className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Instituição"
            type="search"
            name="instituicao"
            placeholder="Ex.: Banco X"
            maxLength={120}
            value={instituicaoDraft}
            onChange={(event) => setInstituicaoDraft(event.target.value)}
          />

          <SelectField
            label="Produto"
            name="produto"
            value={filtros.produto}
            onChange={(event) =>
              trocarProdutoFiltro(event.target.value as ProdutoRendaFixa | "")
            }
          >
            <option value="">Todos os produtos</option>
            {OPCOES_PRODUTO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>

          <TextField
            label="Vencimento até"
            name="vencimentoAte"
            type="date"
            value={filtros.vencimentoAte}
            onChange={(event) => trocarVencimentoFiltro(event.target.value)}
          />

          <div className="flex items-end pb-1.5">
            <Checkbox
              label="Somente com alerta"
              checked={somenteComAlerta}
              onChange={(event) => alternarSomenteComAlerta(event.target.checked)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {temFiltros ? (
            <Button variant="ghost" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </form>

      <div className="flex items-center justify-end gap-2 md:hidden">
        <label htmlFor="ordenacao-renda-fixa" className="text-sm text-neutral-700">
          Ordenar por
        </label>
        <select
          id="ordenacao-renda-fixa"
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

      {carregando || (somenteComAlerta && carregandoAlertas) ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Carregando títulos de renda fixa…</span>
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      ) : erro !== null ? (
        <ErrorState
          message={erro}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : tentarNovamenteLista}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Frenda-fixa" className={ESTILO_BOTAO_PRIMARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : itensVisiveis.length === 0 ? (
        temFiltros ? (
          <EmptyState
            title="Nenhum título encontrado"
            description={
              somenteComAlerta
                ? "Nenhum título corresponde aos filtros e tem alerta ativo."
                : "Nenhum título corresponde aos filtros atuais."
            }
            action={
              <Button variant="secondary" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhum título cadastrado"
            description="Cadastre o primeiro título para acompanhar saldo, vencimento, liquidez e alertas de renda fixa."
            action={<Button onClick={() => setFormAberto(true)}>Cadastrar título</Button>}
          />
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block lg:relative lg:left-1/2 lg:w-[calc(100vw-3rem)] lg:max-w-[1216px] lg:-translate-x-1/2">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <caption className="sr-only">
                Títulos de renda fixa cadastrados. Use os cabeçalhos para ordenar por instituição,
                produto, aplicação, vencimento ou saldo.
              </caption>
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th
                    scope="col"
                    aria-sort={ariaSort("instituicao")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("instituicao")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Instituição
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("instituicao"))}</span>
                      <span className="sr-only">Ordenar por Instituição</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("produto")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("produto")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Produto
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("produto"))}</span>
                      <span className="sr-only">Ordenar por Produto</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Indexador
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Taxa
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("dataAplicacao")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("dataAplicacao")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Aplicação
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("dataAplicacao"))}</span>
                      <span className="sr-only">Ordenar por Aplicação</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("vencimento")}
                    className="px-3 py-2 font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("vencimento")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Vencimento
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("vencimento"))}</span>
                      <span className="sr-only">Ordenar por Vencimento</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("saldoAtual")}
                    className="px-3 py-2 text-right font-semibold text-neutral-700"
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor("saldoAtual")}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      Saldo
                      <span aria-hidden="true">{simboloOrdenacao(ariaSort("saldoAtual"))}</span>
                      <span className="sr-only">Ordenar por Saldo</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Status do saldo
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Liquidez
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Alerta
                  </th>
                </tr>
              </thead>
              <tbody>
                {itensVisiveis.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50"
                  >
                    <td className="max-w-44 truncate px-3 py-3 font-medium text-neutral-900" title={item.instituicao}>
                      {item.instituicao}
                    </td>
                    <td className="px-3 py-3 text-neutral-900">{rotuloProduto(item.produto)}</td>
                    <td className="px-3 py-3 text-neutral-700">
                      {rotuloIndexador(item.indexador)}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">{formatarPercentual(item.taxa)}</td>
                    <td className="px-3 py-3 text-neutral-700">
                      {formatarData(item.dataAplicacao)}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {formatarData(item.vencimento, "Sem vencimento")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="block font-medium text-neutral-900">
                        {formatarMoeda(item.saldoAtual)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTituloParaSaldo(item)}
                        aria-label={`Atualizar saldo de ${item.instituicao} — ${rotuloProduto(item.produto)}`}
                        className="mt-1 text-xs font-medium text-info hover:underline"
                      >
                        Atualizar saldo
                      </button>
                    </td>
                    <td className="px-3 py-3">{renderizarStatusSaldo(item)}</td>
                    <td className="px-3 py-3 text-neutral-700">{rotuloLiquidez(item.liquidez)}</td>
                    <td className="px-3 py-3">{renderizarMarcadorDeAlerta(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {itensVisiveis.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-neutral-900">
                      {item.instituicao}
                    </p>
                    <p className="text-sm text-neutral-700">
                      {rotuloProduto(item.produto)} · {rotuloIndexador(item.indexador)}
                    </p>
                  </div>
                  {renderizarStatusSaldo(item)}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Taxa
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">{formatarPercentual(item.taxa)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Liquidez
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">{rotuloLiquidez(item.liquidez)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Aplicação
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">{formatarData(item.dataAplicacao)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Vencimento
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">
                      {formatarData(item.vencimento, "Sem vencimento")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Saldo
                    </dt>
                    <dd className="mt-0.5 font-semibold text-neutral-900">
                      {formatarMoeda(item.saldoAtual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Alerta
                    </dt>
                    <dd className="mt-0.5">{renderizarMarcadorDeAlerta(item)}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setTituloParaSaldo(item)}
                  aria-label={`Atualizar saldo de ${item.instituicao} — ${rotuloProduto(item.produto)}`}
                  className="mt-3 inline-flex text-sm font-medium text-info hover:underline"
                >
                  Atualizar saldo
                </button>
              </li>
            ))}
          </ul>

          {somenteComAlerta ? (
            recortePorAlertaIndisponivel ? (
              <p className="text-sm text-neutral-700">
                Recorte por alerta indisponível no momento; a lista completa está sendo exibida.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-neutral-700">
                  {itensVisiveis.length} de {total}{" "}
                  {total === 1 ? "título com alerta" : "títulos com alerta"}.
                </p>
                {total > PAGE_SIZE_MAXIMO ? (
                  <p className="text-xs text-neutral-500">
                    Considerando os primeiros {PAGE_SIZE_MAXIMO} títulos na ordenação atual.
                  </p>
                ) : null}
              </div>
            )
          ) : (
            <nav
              aria-label="Paginação de renda fixa"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-neutral-700">
                {total} {total === 1 ? "título" : "títulos"} · Página {resposta?.meta.page ?? 1} de{" "}
                {Math.max(resposta?.meta.totalPages ?? 1, 1)}
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
          )}
        </>
      )}

      <RendaFixaForm
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        onCriado={aoCriar}
        onSessaoExpirada={aoExpirarSessao}
      />

      {tituloParaSaldo === null ? null : (
        <AtualizarSaldoDialog
          key={tituloParaSaldo.id}
          titulo={tituloParaSaldo}
          onFechar={() => setTituloParaSaldo(null)}
          onAtualizado={aoAtualizarSaldo}
          onSessaoExpirada={aoExpirarSessao}
        />
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
