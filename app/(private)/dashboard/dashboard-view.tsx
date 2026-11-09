"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";

import { BarraAlocacaoMeta, CardsResumo } from "./dashboard-cards";
import {
  BarrasRendimentos,
  BarrasSegmento,
  BlocoEmBreve,
  DonutDistribuicao,
  HistoricoDividendos,
  LinhaEvolucaoPatrimonial,
} from "./dashboard-charts";
import { OportunidadesPainel } from "./dashboard-opportunities";
import {
  ROTULOS_BLOCO,
  substituirErroDoBloco,
  type DashboardApi,
  type NomeBlocoDashboard,
} from "./dashboard-ui";

/**
 * Tela inicial (RN-061-5; UI_SPEC §4, §17).
 *
 * O agregado chega em uma única chamada com blocos independentes. O estado de
 * cada bloco é tratado isoladamente: uma falha vira faixa de alerta + bloco
 * "indisponível" com "Tentar novamente", e as demais seções continuam úteis
 * (RN-073). O retry refaz o `GET /api/dashboard` e aplica somente o bloco
 * solicitado — os outros permanecem como estão.
 *
 * No primeiro acesso (`vazio: true`) os cards são substituídos por um convite
 * ao cadastro: nenhum zero é exibido como se fosse patrimônio.
 */

const ESTILO_LINK =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50";

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

function aplicarBloco(
  atual: DashboardApi,
  resposta: DashboardApi,
  bloco: NomeBlocoDashboard,
): DashboardApi {
  const errosDoBloco = resposta.erros.filter((erro) => erro.bloco === bloco);
  let proximo: DashboardApi = {
    ...atual,
    erros: [
      ...atual.erros.filter((erro) => erro.bloco !== bloco),
      ...errosDoBloco,
    ],
  };

  if (bloco === "indicadores" && resposta.indicadores !== undefined) {
    proximo = { ...proximo, indicadores: resposta.indicadores };
  }
  if (bloco === "graficos" && resposta.graficos !== undefined) {
    proximo = { ...proximo, graficos: resposta.graficos };
  }
  if (bloco === "oportunidades" && resposta.oportunidades !== undefined) {
    proximo = { ...proximo, oportunidades: resposta.oportunidades };
  }

  return proximo;
}

function Esqueleto() {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">Carregando dashboard…</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, indice) => (
          <div key={indice} className="h-24 animate-pulse rounded-xl bg-neutral-200" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-52 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-52 animate-pulse rounded-xl bg-neutral-200" />
      </div>
    </div>
  );
}

function BlocoIndisponivel({
  bloco,
  mensagem,
  traceId,
  recarregando,
  onRetry,
}: {
  readonly bloco: NomeBlocoDashboard;
  readonly mensagem: string;
  readonly traceId?: string | null;
  readonly recarregando: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <ErrorState
      title={`${ROTULOS_BLOCO[bloco]} indisponíveis`}
      message={mensagem}
      traceId={traceId}
      onRetry={onRetry}
      retrying={recarregando}
    />
  );
}

export function DashboardView() {
  const [dados, setDados] = useState<DashboardApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroGlobal, setErroGlobal] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [recarregando, setRecarregando] = useState<NomeBlocoDashboard | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<DashboardApi>("/api/dashboard", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setDados(resultado.data);
          setErroGlobal(null);
          setTraceId(null);
          return;
        }

        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
        }
        setErroGlobal(mensagemDeErro(resultado.error));
        setTraceId(lerTraceId(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setErroGlobal(
          "Não foi possível carregar o dashboard. Verifique sua conexão e tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativa]);

  /**
   * Refaz a consulta e aplica apenas o bloco pedido, preservando o que já
   * estava na tela. Falha mantém o bloco com o alerta atualizado.
   */
  async function recarregarBloco(bloco: NomeBlocoDashboard) {
    if (recarregando !== null) {
      return;
    }

    setRecarregando(bloco);
    try {
      const resultado = await apiRequest<DashboardApi>("/api/dashboard");

      if (resultado.ok) {
        setDados((atual) =>
          atual === null ? resultado.data : aplicarBloco(atual, resultado.data, bloco),
        );
        setSessaoExpirada(false);
        return;
      }

      if (ehErroDeSessao(resultado.error)) {
        setSessaoExpirada(true);
      }

      setDados((atual) =>
        atual === null
          ? {
              erros: [
                {
                  bloco,
                  code: resultado.error.code,
                  message: mensagemDeErro(resultado.error),
                },
              ],
            }
          : {
              ...atual,
              erros: substituirErroDoBloco(atual.erros, bloco, {
                bloco,
                code: resultado.error.code,
                message: mensagemDeErro(resultado.error),
              }),
            },
      );
    } catch {
      setDados((atual) =>
        atual === null
          ? {
              erros: [
                {
                  bloco,
                  code: "ERRO_REDE",
                  message:
                    "Não foi possível conectar. Verifique sua conexão e tente novamente.",
                },
              ],
            }
          : {
              ...atual,
              erros: substituirErroDoBloco(atual.erros, bloco, {
                bloco,
                code: "ERRO_REDE",
                message:
                  "Não foi possível conectar. Verifique sua conexão e tente novamente.",
              }),
            },
      );
    } finally {
      setRecarregando(null);
    }
  }

  function tentarNovamenteTudo() {
    setCarregando(true);
    setErroGlobal(null);
    setTraceId(null);
    setSessaoExpirada(false);
    setTentativa((valor) => valor + 1);
  }

  const erros = dados?.erros ?? [];
  const indicadores = dados?.indicadores;
  const graficos = dados?.graficos;
  const oportunidades = dados?.oportunidades;
  const vazio = indicadores?.vazio ?? false;
  const possuiMetas = indicadores === undefined ? true : indicadores.meta.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-700">
          Como está o seu patrimônio e o que exige atenção hoje.
        </p>
      </div>

      {sessaoExpirada ? (
        <Alert
          tone="error"
          title="Sessão expirada"
          action={
            <Link href="/login?callbackUrl=%2Fdashboard" className={ESTILO_LINK}>
              Entrar novamente
            </Link>
          }
        >
          <p>Entre novamente para carregar os dados do dashboard.</p>
        </Alert>
      ) : null}

      {erros.length === 0 ? null : (
        <section aria-label="Alertas de indisponibilidade" className="space-y-2">
          {erros.map((erro) => (
            <Alert
              key={`${erro.bloco}-${erro.code}-${erro.message}`}
              tone="warning"
              title={`${ROTULOS_BLOCO[erro.bloco]} indisponíveis`}
              action={
                <Button
                  variant="secondary"
                  onClick={() => void recarregarBloco(erro.bloco)}
                  carregando={recarregando === erro.bloco}
                >
                  Tentar novamente
                </Button>
              }
            >
              <p>
                {erro.message}{" "}
                <span className="text-xs text-neutral-500">{`(${erro.code})`}</span>
              </p>
            </Alert>
          ))}
        </section>
      )}

      {carregando ? (
        <Esqueleto />
      ) : erroGlobal !== null ? (
        <ErrorState
          message={erroGlobal}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : tentarNovamenteTudo}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Fdashboard" className={ESTILO_LINK}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : dados === null ? null : (
        <>
          {indicadores === undefined || vazio ? null : (
            <>
              <CardsResumo indicadores={indicadores} />
              <BarraAlocacaoMeta indicadores={indicadores} />
            </>
          )}

          {indicadores === undefined ? (
            <BlocoIndisponivel
              bloco="indicadores"
              mensagem={
                dados.erros.find((erro) => erro.bloco === "indicadores")?.message ??
                "Dados indisponíveis neste carregamento."
              }
              recarregando={recarregando === "indicadores"}
              onRetry={() => void recarregarBloco("indicadores")}
            />
          ) : null}

          {vazio && indicadores !== undefined ? (
            <EmptyState
              title="Comece pela sua carteira"
              description={
                <p>
                  Ainda não há patrimônio cadastrado. Cadastre o primeiro ativo ou um título de
                  renda fixa para o dashboard deixar de mostrar zeros — os indicadores aparecem
                  assim que houver dados reais.
                </p>
              }
              action={
                <>
                  <Link href="/ativos/novo" className={ESTILO_LINK}>
                    Cadastrar primeiro ativo
                  </Link>
                  <Link href="/renda-fixa" className={ESTILO_LINK}>
                    Cadastrar renda fixa
                  </Link>
                </>
              }
            />
          ) : null}

          <section aria-labelledby="dashboard-graficos-titulo" className="space-y-3">
            <div className="space-y-1">
              <h2 id="dashboard-graficos-titulo" className="text-lg font-semibold text-neutral-900">
                Gráficos
              </h2>
              <p className="text-sm text-neutral-700">
                Distribuição e evolução da carteira e dos rendimentos. Cada gráfico tem uma tabela
                equivalente acessível.
              </p>
            </div>

            {graficos === undefined ? (
              <BlocoIndisponivel
                bloco="graficos"
                mensagem={
                  dados.erros.find((erro) => erro.bloco === "graficos")?.message ??
                  "Dados indisponíveis neste carregamento."
                }
                recarregando={recarregando === "graficos"}
                onRetry={() => void recarregarBloco("graficos")}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <DonutDistribuicao
                  id="dashboard-por-classe"
                  titulo="Distribuição por classe"
                  descricao="Participação de renda fixa e FIIs no patrimônio total."
                  itens={graficos.porClasse}
                />
                <BarrasSegmento
                  id="dashboard-por-segmento"
                  titulo="Distribuição por segmento"
                  descricao="Participação de cada segmento no patrimônio total."
                  itens={graficos.porSegmento}
                />
                <LinhaEvolucaoPatrimonial
                  id="dashboard-evolucao-patrimonial"
                  titulo="Evolução patrimonial"
                  descricao="Patrimônio nos últimos 12 meses. Na Fase 1, FII entra pelo custo e a renda fixa usa o saldo atual (RN-091)."
                  pontos={graficos.evolucaoPatrimonial}
                />
                <BarrasRendimentos
                  id="dashboard-evolucao-rendimentos"
                  titulo="Evolução dos rendimentos"
                  descricao="Rendimentos recebidos mês a mês nos últimos 12 meses."
                  pontos={graficos.evolucaoRendimentos}
                />
                <BlocoEmBreve
                  titulo="Histórico de aportes"
                  descricao="O histórico de aportes depende do fluxo de sugestão da Fase 2. Os aportes registrados continuam disponíveis em Movimentações."
                />
                <HistoricoDividendos
                  id="dashboard-dividendos"
                  titulo="Histórico de dividendos"
                  descricao="Últimos 12 proventos recebidos, por data de pagamento."
                  dividendos={graficos.dividendos}
                />
              </div>
            )}
          </section>

          {oportunidades === undefined ? (
            <section aria-labelledby="dashboard-oportunidades-titulo" className="space-y-3">
              <h2
                id="dashboard-oportunidades-titulo"
                className="text-lg font-semibold text-neutral-900"
              >
                Oportunidades
              </h2>
              <BlocoIndisponivel
                bloco="oportunidades"
                mensagem={
                  dados.erros.find((erro) => erro.bloco === "oportunidades")?.message ??
                  "Dados indisponíveis neste carregamento."
                }
                recarregando={recarregando === "oportunidades"}
                onRetry={() => void recarregarBloco("oportunidades")}
              />
            </section>
          ) : (
            <OportunidadesPainel
              oportunidades={oportunidades}
              possuiMetas={possuiMetas}
              vazio={vazio}
            />
          )}
        </>
      )}
    </div>
  );
}
