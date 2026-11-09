"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { SelectField } from "@/src/components/ui/select-field";
import { StatusBadge } from "@/src/components/ui/status-badge";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import type { CarteiraApi, PosicaoApi } from "@/src/modules/carteira/apresentacao";
import {
  FILTROS_VAZIOS,
  MOTIVO_COTACAO_INDISPONIVEL,
  MOTIVO_RESULTADO_INDISPONIVEL,
  OPCOES_STATUS,
  ORDENACAO_PADRAO,
  PAGE_SIZE_STATUS,
  TONS_STATUS,
  ariaSortDe,
  classesDaCarteira,
  ehPatrimonioVazio,
  filtrarPosicoes,
  formatarDataHora,
  formatarMoeda,
  formatarPercentual,
  formatarQuantidade,
  mapaDeStatus,
  ordenarPosicoes,
  possuiValorIndisponivel,
  proximaOrdenacao,
  rotuloStatus,
  segmentosDaCarteira,
  temFiltroAtivo,
  type ColunaOrdenavel,
  type FiltrosPosicao,
  type ListaAtivosStatusApi,
  type MapaStatusAtivo,
  type OpcaoFiltro,
  type OrdenacaoPosicao,
  type StatusAtivo,
} from "./carteira-ui";

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";

const ESTILO_BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50";

const TITULO_STATUS_INDISPONIVEL = "Status do ativo indisponível.";

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

interface CartaoResumoProps {
  readonly titulo: string;
  readonly valor: string;
  readonly detalhe?: string;
}

function CartaoResumo({ titulo, valor, detalhe }: CartaoResumoProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</dt>
      <dd className="mt-1 break-words text-xl font-semibold text-neutral-900">{valor}</dd>
      {detalhe === undefined ? null : (
        <dd className="mt-0.5 text-sm text-neutral-700">{detalhe}</dd>
      )}
    </div>
  );
}

interface BlocoDistribuicaoProps {
  readonly titulo: string;
  readonly itens: CarteiraApi["porClasse"];
  readonly vazio: string;
}

/** Distribuição por classe/segmento com valor e percentual (UI_SPEC §5, RN-020). */
function BlocoDistribuicao({ titulo, itens, vazio }: BlocoDistribuicaoProps) {
  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
      <h3 className="text-base font-semibold text-neutral-900">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-neutral-700">{vazio}</p>
      ) : (
        <dl className="space-y-2">
          {itens.map((item) => (
            <div
              key={item.codigo}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
            >
              <dt className="min-w-0 break-words text-sm text-neutral-900">
                {item.nome}
                {item.valorIndisponivel ? (
                  <span
                    title={MOTIVO_COTACAO_INDISPONIVEL}
                    className="ml-1 text-xs font-medium text-warning"
                  >
                    valor pelo custo
                  </span>
                ) : null}
              </dt>
              <dd className="text-sm text-neutral-700">
                {`${formatarMoeda(item.valor)} · ${formatarPercentual(item.percentual)}`}
              </dd>
            </div>
          ))}
        </dl>
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

interface CabecalhoOrdenavelProps {
  readonly rotulo: string;
  readonly coluna: ColunaOrdenavel;
  readonly ordenacao: OrdenacaoPosicao;
  readonly onOrdenar: (coluna: ColunaOrdenavel) => void;
  readonly alinhamento?: "left" | "right";
}

function CabecalhoOrdenavel({
  rotulo,
  coluna,
  ordenacao,
  onOrdenar,
  alinhamento = "left",
}: CabecalhoOrdenavelProps) {
  const direcao = ariaSortDe(ordenacao, coluna);

  return (
    <th
      scope="col"
      aria-sort={direcao}
      className={[
        "px-3 py-2 font-semibold text-neutral-700",
        alinhamento === "right" ? "text-right" : "text-left",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className="inline-flex items-center gap-1 hover:text-neutral-900"
      >
        {rotulo}
        <span aria-hidden="true">{simboloOrdenacao(direcao)}</span>
        <span className="sr-only">{`Ordenar por ${rotulo}`}</span>
      </button>
    </th>
  );
}

function Situacao({ status }: { readonly status: StatusAtivo | undefined }) {
  if (status === undefined) {
    return <span title={TITULO_STATUS_INDISPONIVEL}>—</span>;
  }

  return <StatusBadge tone={TONS_STATUS[status]}>{rotuloStatus(status)}</StatusBadge>;
}

function PrecoAtual() {
  return (
    <span title={MOTIVO_COTACAO_INDISPONIVEL} className="text-neutral-700">
      Indisponível
    </span>
  );
}

function Resultado() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{`Resultado indisponível: ${MOTIVO_RESULTADO_INDISPONIVEL}`}</span>
    </>
  );
}

function IndicadorValorIndisponivel() {
  return (
    <span title={MOTIVO_COTACAO_INDISPONIVEL} className="text-xs font-medium text-warning">
      valor indisponível
    </span>
  );
}

function Esqueleto() {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">Carregando carteira…</span>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-neutral-200" />
    </div>
  );
}

/**
 * Tela de carteira (UI_SPEC §5; RN-020, RN-038, RN-091).
 *
 * Consolida o resumo, a distribuição por classe/segmento e as posições de FII.
 * Classe e segmento são filtrados no cliente sobre `posicoes`; a situação do
 * ativo vem de `GET /api/ativos` (mapa `ativoId → status`), com o teto de 100
 * ativos documentado em `carteira-ui.ts`.
 *
 * Sem cotação, o valor atual é o custo de aquisição e a linha recebe a marca
 * "valor indisponível"; "Preço atual" e "Resultado" nunca viram zero inventado
 * (RN-091).
 */
export function CarteiraView() {
  const [carteira, setCarteira] = useState<CarteiraApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const [statusPorAtivo, setStatusPorAtivo] = useState<MapaStatusAtivo>({});
  const [erroStatus, setErroStatus] = useState(false);
  const [tentativaStatus, setTentativaStatus] = useState(0);

  const [filtros, setFiltros] = useState<FiltrosPosicao>(FILTROS_VAZIOS);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoPosicao>(ORDENACAO_PADRAO);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<CarteiraApi>("/api/carteira", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setCarteira(resultado.data);
          setErro(null);
          setTraceId(null);
          setSessaoExpirada(false);
          return;
        }

        setCarteira(null);
        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
        }
        setErro(mensagemDeErro(resultado.error));
        setTraceId(lerTraceId(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setCarteira(null);
        setErro(
          "Não foi possível carregar a carteira. Verifique sua conexão e tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativa]);

  const precisaStatus = carteira !== null && carteira.posicoes.length > 0;

  useEffect(() => {
    if (!precisaStatus) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        // Limitação: `/api/ativos` pagina até 100 por vez (teto do contrato).
        // Acima disso o mapa fica incompleto — ativos excedentes aparecem com
        // situação "—" e não entram no filtro por status.
        const resultado = await apiRequest<ListaAtivosStatusApi>(
          `/api/ativos?pageSize=${PAGE_SIZE_STATUS}&sort=ticker&order=asc`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setStatusPorAtivo(mapaDeStatus(resultado.data));
          setErroStatus(false);
          return;
        }

        setStatusPorAtivo({});
        setErroStatus(true);
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setStatusPorAtivo({});
        setErroStatus(true);
      }
    })();

    return () => controller.abort();
  }, [precisaStatus, tentativa, tentativaStatus]);

  const posicoes = carteira?.posicoes ?? [];
  const classes = classesDaCarteira(posicoes);
  const segmentos = segmentosDaCarteira(posicoes, filtros.classe);
  const filtroAtivo = temFiltroAtivo(filtros);
  const posicoesVisiveis = ordenarPosicoes(
    filtrarPosicoes(posicoes, statusPorAtivo, filtros),
    ordenacao,
  );

  function alterarFiltro(patch: Partial<FiltrosPosicao>) {
    setFiltros((atual) => ({ ...atual, ...patch }));
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
  }

  function tentarNovamente() {
    setCarregando(true);
    setErro(null);
    setTraceId(null);
    setSessaoExpirada(false);
    setTentativa((valor) => valor + 1);
  }

  function tentarNovamenteStatus() {
    setErroStatus(false);
    setTentativaStatus((valor) => valor + 1);
  }

  function ordenarPor(coluna: ColunaOrdenavel) {
    setOrdenacao((atual) => proximaOrdenacao(atual, coluna));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Carteira</h1>
        <p className="text-sm text-neutral-700">
          Patrimônio consolidado por classe e segmento, com a participação de cada ativo.
        </p>
      </div>

      {carregando ? (
        <Esqueleto />
      ) : erro !== null ? (
        <ErrorState
          title="Não foi possível carregar a carteira"
          message={erro}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : tentarNovamente}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Fcarteira" className={ESTILO_BOTAO_PRIMARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : carteira === null ? null : ehPatrimonioVazio(carteira) ? (
        <EmptyState
          title="Sua carteira está vazia"
          description="Cadastre um ativo ou um título de renda fixa para começar a acompanhar patrimônio, distribuição e rendimentos."
          action={
            <>
              <Link href="/ativos/novo" className={ESTILO_BOTAO_PRIMARIO}>
                Cadastrar ativo
              </Link>
              <Link href="/renda-fixa" className={ESTILO_BOTAO_SECUNDARIO}>
                Cadastrar renda fixa
              </Link>
            </>
          }
        />
      ) : (
        <>
          <section aria-labelledby="carteira-resumo-titulo" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="carteira-resumo-titulo" className="text-xl font-semibold text-neutral-900">
                Resumo
              </h2>
              <p className="text-xs text-neutral-500">
                {`Atualizado em ${formatarDataHora(carteira.atualizadoEm)}`}
              </p>
            </div>

            {carteira.cotacoes.statusDado === "INDISPONIVEL" ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
                <StatusBadge tone="warning">Sem cotação — valores pelo custo</StatusBadge>
                <span className="text-xs text-neutral-500">
                  Posições sem preço usam o custo de aquisição e são marcadas como “valor
                  indisponível” (RN-091).
                </span>
              </p>
            ) : null}

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CartaoResumo
                titulo="Patrimônio total"
                valor={formatarMoeda(carteira.resumo.patrimonioTotal)}
              />
              <CartaoResumo
                titulo="Renda fixa"
                valor={formatarMoeda(carteira.resumo.rendaFixa)}
                detalhe={`${formatarPercentual(carteira.resumo.percentualRendaFixa)} da carteira`}
              />
              <CartaoResumo
                titulo="FIIs"
                valor={formatarMoeda(carteira.resumo.fiis)}
                detalhe={`${formatarPercentual(carteira.resumo.percentualFiis)} da carteira`}
              />
              <CartaoResumo
                titulo="Ativos na carteira"
                valor={String(carteira.resumo.quantidadeAtivos)}
                detalhe={carteira.resumo.quantidadeAtivos === 1 ? "ativo" : "ativos"}
              />
              <CartaoResumo
                titulo="Rendimentos do mês"
                valor={formatarMoeda(carteira.resumo.rendimentosMes)}
              />
              <CartaoResumo
                titulo="Rendimentos no ano"
                valor={formatarMoeda(carteira.resumo.rendimentosAcumuladosAno)}
              />
            </dl>
          </section>

          {carteira.consistente ? null : (
            <Alert tone="warning" title="Divergência nos totais da carteira">
              <p>A soma por classe não fecha com o total — verifique os dados.</p>
            </Alert>
          )}

          <section aria-labelledby="carteira-distribuicao-titulo" className="space-y-3">
            <h2
              id="carteira-distribuicao-titulo"
              className="text-xl font-semibold text-neutral-900"
            >
              Distribuição
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <BlocoDistribuicao
                titulo="Por classe"
                itens={carteira.porClasse}
                vazio="Nenhuma classe com patrimônio."
              />
              <BlocoDistribuicao
                titulo="Por segmento"
                itens={carteira.porSegmento}
                vazio="Nenhum segmento com patrimônio."
              />
            </div>
          </section>

          <section aria-labelledby="carteira-posicoes-titulo" className="space-y-3">
            <div className="space-y-1">
              <h2
                id="carteira-posicoes-titulo"
                className="text-xl font-semibold text-neutral-900"
              >
                Posições
              </h2>
              <p className="text-sm text-neutral-700">
                Posições de FII por ativo. A renda fixa é acompanhada em{" "}
                <Link href="/renda-fixa" className="text-info hover:underline">
                  Renda fixa
                </Link>
                .
              </p>
            </div>

            {posicoes.length === 0 ? (
              <EmptyState
                title="Nenhuma posição de FII"
                description="Não há ativos com posição na carteira. Cadastre um ativo e registre uma movimentação para vê-lo aqui."
                action={
                  <Link href="/ativos/novo" className={ESTILO_BOTAO_PRIMARIO}>
                    Cadastrar ativo
                  </Link>
                }
              />
            ) : (
              <>
                <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:grid-cols-3">
                  <SelectField
                    label="Classe"
                    value={filtros.classe}
                    onChange={(event) =>
                      alterarFiltro({ classe: event.target.value, segmento: "" })
                    }
                  >
                    <option value="">Todas as classes</option>
                    {classes.map((opcao: OpcaoFiltro) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Segmento"
                    value={filtros.segmento}
                    disabled={segmentos.length === 0}
                    hint={
                      segmentos.length === 0
                        ? "Nenhum segmento disponível para a classe selecionada."
                        : undefined
                    }
                    onChange={(event) => alterarFiltro({ segmento: event.target.value })}
                  >
                    <option value="">Todos os segmentos</option>
                    {segmentos.map((opcao: OpcaoFiltro) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Status"
                    value={filtros.status}
                    disabled={erroStatus}
                    hint={erroStatus ? "Status dos ativos indisponível." : undefined}
                    onChange={(event) =>
                      alterarFiltro({ status: event.target.value as FiltrosPosicao["status"] })
                    }
                  >
                    <option value="">Todos os status</option>
                    {OPCOES_STATUS.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p aria-live="polite" className="text-sm text-neutral-700">
                    {filtroAtivo
                      ? `${posicoesVisiveis.length} de ${posicoes.length} posições`
                      : `${posicoes.length} ${posicoes.length === 1 ? "posição" : "posições"}`}
                  </p>
                  {filtroAtivo ? (
                    <Button variant="ghost" onClick={limparFiltros}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>

                {erroStatus ? (
                  <Alert
                    tone="warning"
                    title="Situação dos ativos indisponível"
                    action={
                      <Button variant="secondary" onClick={tentarNovamenteStatus}>
                        Tentar novamente
                      </Button>
                    }
                  >
                    <p>
                      O status dos ativos não carregou. A coluna “Situação” aparece como “—” e o
                      filtro por status fica desativado; as demais informações continuam válidas.
                    </p>
                  </Alert>
                ) : null}

                {possuiValorIndisponivel(carteira) ? (
                  <Alert tone="info" title="Valores pelo custo de aquisição">
                    <p>
                      Sem cotação de mercado, “Preço atual” aparece como “Indisponível” e
                      “Resultado” como “—”. O valor atual usa o custo de aquisição, marcado como
                      “valor indisponível” (RN-091).
                    </p>
                  </Alert>
                ) : null}

                {posicoesVisiveis.length === 0 ? (
                  <EmptyState
                    title="Nenhuma posição encontrada"
                    description="Nenhuma posição corresponde aos filtros atuais."
                    action={
                      <Button variant="secondary" onClick={limparFiltros}>
                        Limpar filtros
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block lg:relative lg:left-1/2 lg:w-[calc(100vw-3rem)] lg:max-w-[1216px] lg:-translate-x-1/2">
                      <table className="w-full min-w-[1080px] border-collapse text-sm">
                        <caption className="sr-only">
                          Posições da carteira. Use os cabeçalhos Ticker, Quantidade, Valor atual e
                          % da carteira para ordenar.
                        </caption>
                        <thead className="border-b border-neutral-200 bg-neutral-50">
                          <tr>
                            <CabecalhoOrdenavel
                              rotulo="Ticker"
                              coluna="ticker"
                              ordenacao={ordenacao}
                              onOrdenar={ordenarPor}
                            />
                            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-700">
                              Nome
                            </th>
                            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-700">
                              Segmento
                            </th>
                            <CabecalhoOrdenavel
                              rotulo="Quantidade"
                              coluna="quantidade"
                              ordenacao={ordenacao}
                              onOrdenar={ordenarPor}
                              alinhamento="right"
                            />
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                              Preço médio
                            </th>
                            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-700">
                              Preço atual
                            </th>
                            <CabecalhoOrdenavel
                              rotulo="Valor atual"
                              coluna="valorAtual"
                              ordenacao={ordenacao}
                              onOrdenar={ordenarPor}
                              alinhamento="right"
                            />
                            <CabecalhoOrdenavel
                              rotulo="% da carteira"
                              coluna="percentual"
                              ordenacao={ordenacao}
                              onOrdenar={ordenarPor}
                              alinhamento="right"
                            />
                            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-700">
                              Resultado
                            </th>
                            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-700">
                              Situação
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {posicoesVisiveis.map((posicao) => (
                            <tr
                              key={posicao.ativoId}
                              className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50"
                            >
                              <td className="px-3 py-3 font-medium text-neutral-900">
                                <Link
                                  href={`/ativos/${posicao.ativoId}`}
                                  className="text-info hover:underline"
                                  aria-label={`Abrir ficha de ${posicao.ticker}`}
                                >
                                  {posicao.ticker}
                                </Link>
                              </td>
                              <td
                                className="max-w-56 truncate px-3 py-3 text-neutral-900"
                                title={posicao.nome}
                              >
                                {posicao.nome}
                              </td>
                              <td className="px-3 py-3 text-neutral-700">
                                {posicao.segmento?.nome ?? "—"}
                              </td>
                              <td className="px-3 py-3 text-right text-neutral-700">
                                <span className="whitespace-nowrap">
                                  {formatarQuantidade(posicao.quantidade)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-neutral-700">
                                <span className="whitespace-nowrap">
                                  {formatarMoeda(posicao.precoMedio)}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <PrecoAtual />
                              </td>
                              <td className="px-3 py-3 text-right text-neutral-900">
                                <span className="block whitespace-nowrap font-medium">
                                  {formatarMoeda(posicao.valorAtual)}
                                </span>
                                {posicao.valorIndisponivel ? (
                                  <span className="mt-0.5 inline-block">
                                    <IndicadorValorIndisponivel />
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-right text-neutral-700">
                                {formatarPercentual(posicao.percentual)}
                              </td>
                              <td className="px-3 py-3">
                                <Resultado />
                              </td>
                              <td className="px-3 py-3">
                                <Situacao status={statusPorAtivo[posicao.ativoId]} />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Link
                                  href={`/ativos/${posicao.ativoId}`}
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

                    <ul className="space-y-3 md:hidden" aria-label="Posições da carteira em cartões">
                      {posicoesVisiveis.map((posicao: PosicaoApi) => (
                        <li
                          key={posicao.ativoId}
                          className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/ativos/${posicao.ativoId}`}
                                className="font-semibold text-info hover:underline"
                                aria-label={`Abrir ficha de ${posicao.ticker}`}
                              >
                                {posicao.ticker}
                              </Link>
                              <p className="break-words text-sm text-neutral-700">{posicao.nome}</p>
                            </div>
                            <Situacao status={statusPorAtivo[posicao.ativoId]} />
                          </div>

                          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Segmento
                              </dt>
                              <dd className="mt-0.5 break-words text-neutral-900">
                                {posicao.segmento?.nome ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Quantidade
                              </dt>
                              <dd className="mt-0.5 text-neutral-900">
                                {formatarQuantidade(posicao.quantidade)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Preço médio
                              </dt>
                              <dd className="mt-0.5 text-neutral-900">
                                {formatarMoeda(posicao.precoMedio)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Preço atual
                              </dt>
                              <dd className="mt-0.5">
                                <PrecoAtual />
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Valor atual
                              </dt>
                              <dd className="mt-0.5 text-neutral-900">
                                <span className="block font-medium">
                                  {formatarMoeda(posicao.valorAtual)}
                                </span>
                                {posicao.valorIndisponivel ? (
                                  <span className="mt-0.5 inline-block">
                                    <IndicadorValorIndisponivel />
                                  </span>
                                ) : null}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                % da carteira
                              </dt>
                              <dd className="mt-0.5 text-neutral-900">
                                {formatarPercentual(posicao.percentual)}
                              </dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Resultado
                              </dt>
                              <dd className="mt-0.5 text-neutral-700">
                                <Resultado />
                              </dd>
                            </div>
                          </dl>

                          <Link
                            href={`/ativos/${posicao.ativoId}`}
                            className="mt-3 inline-flex text-sm font-medium text-info hover:underline"
                            aria-label={`Abrir ficha de ${posicao.ticker}`}
                          >
                            Abrir ficha
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
