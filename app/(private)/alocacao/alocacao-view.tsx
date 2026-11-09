"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { ErrorState } from "@/src/components/ui/error-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import type {
  DesviosApi,
  MetasApi,
  MetasVigentesApi,
} from "@/src/modules/alocacao/apresentacao";
import {
  ROTULOS_REFERENCIA,
  ROTULOS_SITUACAO,
  TONS_SITUACAO,
  ajusteDeSoma,
  formatarDesvio,
  formatarMoeda,
  formatarPercentual,
  itensDoEscopo,
  linhasDaVigente,
  linhasInvalidas,
  montarPayload,
  nomesDaReferencia,
  possuiValorIndisponivel,
  rotuloReferencia,
  semPatrimonio,
  somarPercentuais,
  type EscopoMeta,
  type ItemDesvio,
  type LinhaMetaForm,
  type ReferenciaAtivosResposta,
} from "./alocacao-ui";

const ESTILO_BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50";

const TITULO_CUSTO =
  "Valor atual calculado pelo custo de aquisição, sem cotação de mercado (RN-091).";

interface ErroDeEscopo {
  readonly escopo: EscopoMeta;
  readonly mensagem: string;
}

interface RespostaPutMetas {
  readonly vigente: MetasVigentesApi;
}

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

function mensagemDeSoma(erro: ApiError): string {
  const soma = typeof erro.details?.soma === "string" ? erro.details.soma : null;
  if (soma === null) {
    return "A soma das metas deve ser 100%. Ajuste os percentuais e tente novamente.";
  }
  return `A soma das metas deve ser 100% — recebido ${formatarPercentual(soma)}.`;
}

function mensagemDeEscopo(erro: ApiError): ErroDeEscopo | null {
  const escopo = erro.details?.escopo;
  if (escopo !== "CLASSE" && escopo !== "SEGMENTO") {
    return null;
  }
  return { escopo, mensagem: mensagemDeSoma(erro) };
}

interface BlocoMetasProps {
  readonly id: "classe" | "segmento";
  readonly titulo: string;
  readonly descricao: string;
  readonly linhas: readonly LinhaMetaForm[];
  readonly nomes: Readonly<Record<string, string>>;
  readonly erroDoServidor: string | null;
  readonly salvando: boolean;
  readonly onAlterar: (id: string, valor: string) => void;
  readonly onSalvar: () => void;
}

/**
 * Bloco de metas com soma em tempo real (UI_SPEC §9, §16).
 *
 * A soma é calculada a cada tecla — a única validação da tela permitida nesse
 * ritmo. O botão fica desabilitado enquanto a soma do escopo não é 100, mas
 * continua visível; a mensagem diz quanto falta/excede, nunca só a cor.
 */
function BlocoMetas({
  id,
  titulo,
  descricao,
  linhas,
  nomes,
  erroDoServidor,
  salvando,
  onAlterar,
  onSalvar,
}: BlocoMetasProps) {
  const soma = somarPercentuais(linhas);
  const ajuste = ajusteDeSoma(soma);
  const invalidos = linhasInvalidas(linhas);
  const somaId = `alocacao-soma-${id}`;
  const podeSalvar = ajuste === null && invalidos.length === 0;

  return (
    <section
      aria-labelledby={`alocacao-${id}-titulo`}
      className={[
        "space-y-4 rounded-xl border bg-neutral-0 p-4",
        erroDoServidor === null ? "border-neutral-200" : "border-negative",
      ].join(" ")}
    >
      <div className="space-y-1">
        <h2 id={`alocacao-${id}-titulo`} className="text-base font-semibold text-neutral-900">
          {titulo}
        </h2>
        <p className="text-sm text-neutral-700">{descricao}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {linhas.map((linha) => {
          const invalido = invalidos.includes(linha.id);
          const inputId = `alocacao-${id}-${linha.codigo}`;

          return (
            <div key={linha.id} className="flex items-center justify-between gap-2">
              <label
                htmlFor={inputId}
                className="min-w-0 break-words text-sm font-medium text-neutral-900"
              >
                {rotuloReferencia(linha.codigo, nomes)}
              </label>
              <div className="flex shrink-0 items-center gap-1">
                <input
                  id={inputId}
                  inputMode="decimal"
                  autoComplete="off"
                  value={linha.percentual}
                  onChange={(event) => onAlterar(linha.id, event.target.value)}
                  aria-invalid={invalido ? true : undefined}
                  aria-describedby={somaId}
                  className={[
                    "w-20 rounded-lg border bg-neutral-0 px-2 py-1.5 text-right text-sm text-neutral-900",
                    invalido ? "border-negative" : "border-neutral-200",
                  ].join(" ")}
                />
                <span aria-hidden="true" className="text-sm text-neutral-700">
                  %
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <p id={somaId} aria-live="polite" className="text-sm text-neutral-900">
          <span>{`Soma: ${formatarPercentual(soma.toString())}.`}</span>{" "}
          {ajuste === null ? (
            <span className="font-medium text-positive">Soma correta.</span>
          ) : (
            <span className="font-medium text-negative">{ajuste.texto}</span>
          )}
        </p>
        {invalidos.length === 0 ? null : (
          <p className="text-sm text-negative">Informe percentuais entre 0 e 100.</p>
        )}
        {erroDoServidor === null ? null : (
          <p role="alert" className="text-sm font-medium text-negative">
            {erroDoServidor}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onSalvar}
          disabled={!podeSalvar}
          carregando={salvando}
          aria-label={`Salvar metas por ${id === "classe" ? "classe" : "segmento"}`}
        >
          Salvar
        </Button>
      </div>
    </section>
  );
}

interface TabelaDesviosProps {
  readonly titulo: string;
  readonly itens: readonly ItemDesvio[];
  readonly nomes: Readonly<Record<string, string>>;
}

function TabelaDesvios({ titulo, itens, nomes }: TabelaDesviosProps) {
  if (itens.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-neutral-900">{titulo}</h3>

      <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            {`${titulo}: referência, percentual atual, meta, desvio em pontos percentuais, valor para atingir a meta e situação.`}
          </caption>
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Referência
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Atual
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Meta
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Desvio (p.p.)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                Valor para meta
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={`${item.escopo}-${item.codigo}`} className="border-b border-neutral-200 last:border-b-0">
                <td className="max-w-56 px-3 py-3">
                  <span className="font-medium text-neutral-900">
                    {rotuloReferencia(item.codigo, nomes)}
                  </span>
                  {item.valorIndisponivel ? (
                    <span
                      title={TITULO_CUSTO}
                      className="mt-0.5 block text-xs font-medium text-warning"
                    >
                      Valor pelo custo
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-neutral-700">
                  {formatarPercentual(item.percentualAtual)}
                </td>
                <td className="px-3 py-3 text-neutral-700">
                  {formatarPercentual(item.percentualMeta)}
                </td>
                <td className="px-3 py-3 text-neutral-900">
                  {`${formatarDesvio(item.desvioPontos)} p.p.`}
                </td>
                <td className="px-3 py-3 text-right text-neutral-900">
                  {formatarMoeda(item.valorParaMeta)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge tone={TONS_SITUACAO[item.situacao]}>
                    {ROTULOS_SITUACAO[item.situacao]}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {itens.map((item) => (
          <li
            key={`${item.escopo}-${item.codigo}`}
            className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold text-neutral-900">
                  {rotuloReferencia(item.codigo, nomes)}
                </p>
                {item.valorIndisponivel ? (
                  <p title={TITULO_CUSTO} className="mt-0.5 text-xs font-medium text-warning">
                    Valor pelo custo
                  </p>
                ) : null}
              </div>
              <StatusBadge tone={TONS_SITUACAO[item.situacao]}>
                {ROTULOS_SITUACAO[item.situacao]}
              </StatusBadge>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Atual</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {formatarPercentual(item.percentualAtual)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Meta</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {formatarPercentual(item.percentualMeta)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Desvio (p.p.)
                </dt>
                <dd className="mt-0.5 text-neutral-900">
                  {`${formatarDesvio(item.desvioPontos)} p.p.`}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Valor para meta
                </dt>
                <dd className="mt-0.5 text-neutral-900">{formatarMoeda(item.valorParaMeta)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Esqueleto() {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">Carregando metas e desvios…</span>
      <div className="h-44 animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-44 animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-36 animate-pulse rounded-xl bg-neutral-200" />
    </div>
  );
}

/**
 * Tela de alocação (UI_SPEC §9; RN-021 a RN-024, RN-082).
 *
 * Dois blocos de metas (classe e segmento) com soma em tempo real e uma seção
 * de desvios por escopo. A configuração nunca é escondida quando falta
 * patrimônio: a tabela mostra 0% e a tela oferece o cadastro de ativo.
 *
 * O `PUT` substitui os dois escopos de uma vez (API_CONTRACTS.md §7.2), por
 * isso o diálogo de confirmação explica que a configuração vigente passa a
 * histórico antes de qualquer gravação.
 */
export function AlocacaoView() {
  const [classe, setClasse] = useState<readonly LinhaMetaForm[]>([]);
  const [segmento, setSegmento] = useState<readonly LinhaMetaForm[]>([]);
  const [nomes, setNomes] = useState<Readonly<Record<string, string>>>(ROTULOS_REFERENCIA);

  const [carregandoMetas, setCarregandoMetas] = useState(true);
  const [metasCarregadas, setMetasCarregadas] = useState(false);
  const [erroMetas, setErroMetas] = useState<string | null>(null);
  const [traceMetas, setTraceMetas] = useState<string | null>(null);
  const [tentativaMetas, setTentativaMetas] = useState(0);

  const [carregandoDesvios, setCarregandoDesvios] = useState(true);
  const [desvios, setDesvios] = useState<DesviosApi | null>(null);
  const [erroDesvios, setErroDesvios] = useState<string | null>(null);
  const [traceDesvios, setTraceDesvios] = useState<string | null>(null);
  const [tentativaDesvios, setTentativaDesvios] = useState(0);

  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroDeEscopo, setErroDeEscopo] = useState<ErroDeEscopo | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<MetasApi>("/api/alocacao/metas", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          const linhas = linhasDaVigente(resultado.data.vigente);
          setClasse(linhas.classe);
          setSegmento(linhas.segmento);
          setMetasCarregadas(true);
          setErroMetas(null);
          setTraceMetas(null);
          return;
        }

        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
        }
        setErroMetas(mensagemDeErro(resultado.error));
        setTraceMetas(lerTraceId(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setErroMetas(
          "Não foi possível carregar as metas de alocação. Verifique sua conexão e tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoMetas(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaMetas]);

  useEffect(() => {
    // Os desvios dependem das metas: no primeiro acesso o `GET /metas`
    // materializa os defaults (lazy). Consultar antes disso devolveria
    // `ALO_METAS_AUSENTES` sem o titular ter feito nada de errado.
    if (!metasCarregadas) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<DesviosApi>("/api/alocacao/desvios", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setDesvios(resultado.data);
          setErroDesvios(null);
          setTraceDesvios(null);
          return;
        }

        setDesvios(null);
        setErroDesvios(mensagemDeErro(resultado.error));
        setTraceDesvios(lerTraceId(resultado.error));
        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
        }
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setDesvios(null);
        setErroDesvios("Não foi possível carregar os desvios de alocação.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoDesvios(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaDesvios, metasCarregadas]);

  // Catálogo de referência é opcional: sem ele a tela segue com os rótulos do seed.
  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<ReferenciaAtivosResposta>("/api/referencia/ativos", {
          signal: controller.signal,
        });
        if (controller.signal.aborted || !resultado.ok) {
          return;
        }
        setNomes({ ...ROTULOS_REFERENCIA, ...nomesDaReferencia(resultado.data) });
      } catch {
        // Rótulo é refinamento visual; a tela continua com o fallback estático.
      }
    })();

    return () => controller.abort();
  }, []);

  function alterarLinha(escopo: EscopoMeta, id: string, valor: string) {
    setErroDeEscopo(null);
    setErroSalvar(null);
    const atualizar = (linhas: readonly LinhaMetaForm[]) =>
      linhas.map((linha) => (linha.id === id ? { ...linha, percentual: valor } : linha));

    if (escopo === "CLASSE") {
      setClasse(atualizar);
    } else {
      setSegmento(atualizar);
    }
  }

  function abrirConfirmacao() {
    setErroSalvar(null);
    setErroDeEscopo(null);
    setConfirmacaoAberta(true);
  }

  async function confirmarSalvamento() {
    setSalvando(true);
    setErroSalvar(null);
    setErroDeEscopo(null);

    try {
      const resultado = await apiRequest<RespostaPutMetas>("/api/alocacao/metas", {
        method: "PUT",
        body: montarPayload(classe, segmento),
      });

      if (resultado.ok) {
        const linhas = linhasDaVigente(resultado.data.vigente);
        setClasse(linhas.classe);
        setSegmento(linhas.segmento);
        setConfirmacaoAberta(false);
        setFeedback("Metas salvas. A configuração anterior foi preservada no histórico.");
        setCarregandoDesvios(true);
        setTentativaDesvios((valor) => valor + 1);
        return;
      }

      setConfirmacaoAberta(false);

      if (resultado.error.code === "ALO_SOMA_METAS_INVALIDA") {
        const escopo = mensagemDeEscopo(resultado.error);
        if (escopo === null) {
          setErroSalvar(mensagemDeSoma(resultado.error));
        } else {
          setErroDeEscopo(escopo);
        }
        return;
      }

      if (ehErroDeSessao(resultado.error)) {
        setSessaoExpirada(true);
      }
      setErroSalvar(mensagemDeErro(resultado.error));
    } catch {
      setConfirmacaoAberta(false);
      setErroSalvar("Não foi possível salvar as metas. Verifique sua conexão e tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function tentarNovamenteMetas() {
    setCarregandoMetas(true);
    setErroMetas(null);
    setTraceMetas(null);
    setSessaoExpirada(false);
    setTentativaMetas((valor) => valor + 1);
  }

  function tentarNovamenteDesvios() {
    setCarregandoDesvios(true);
    setErroDesvios(null);
    setTraceDesvios(null);
    setTentativaDesvios((valor) => valor + 1);
  }

  const itensClasse = desvios === null ? [] : itensDoEscopo(desvios, "CLASSE");
  const itensSegmento = desvios === null ? [] : itensDoEscopo(desvios, "SEGMENTO");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Alocação</h1>
        <p className="text-sm text-neutral-700">
          Defina as metas por classe e por segmento e acompanhe o desvio em relação ao patrimônio
          total da carteira.
        </p>
      </div>

      {feedback === null ? null : (
        <Alert
          tone="success"
          title="Metas salvas"
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
          title="Não foi possível salvar as metas"
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Falocacao" className={ESTILO_BOTAO_SECUNDARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        >
          <p>{erroSalvar}</p>
        </Alert>
      )}

      {carregandoMetas ? (
        <Esqueleto />
      ) : erroMetas !== null ? (
        <ErrorState
          title="Não foi possível carregar as metas"
          message={erroMetas}
          traceId={traceMetas}
          onRetry={sessaoExpirada ? undefined : tentarNovamenteMetas}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Falocacao" className={ESTILO_BOTAO_SECUNDARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <BlocoMetas
            id="classe"
            titulo="Metas por classe"
            descricao="A soma das classes precisa ser exatamente 100%."
            linhas={classe}
            nomes={nomes}
            erroDoServidor={erroDeEscopo?.escopo === "CLASSE" ? erroDeEscopo.mensagem : null}
            salvando={salvando}
            onAlterar={(id, valor) => alterarLinha("CLASSE", id, valor)}
            onSalvar={abrirConfirmacao}
          />

          <BlocoMetas
            id="segmento"
            titulo="Metas por segmento"
            descricao="A soma dos segmentos precisa ser exatamente 100%."
            linhas={segmento}
            nomes={nomes}
            erroDoServidor={erroDeEscopo?.escopo === "SEGMENTO" ? erroDeEscopo.mensagem : null}
            salvando={salvando}
            onAlterar={(id, valor) => alterarLinha("SEGMENTO", id, valor)}
            onSalvar={abrirConfirmacao}
          />
        </>
      )}

      {metasCarregadas ? (
        <section aria-labelledby="alocacao-desvios-titulo" className="space-y-4">
        <div className="space-y-1">
          <h2 id="alocacao-desvios-titulo" className="text-xl font-semibold text-neutral-900">
            Desvios
          </h2>
          <p className="text-sm text-neutral-700">
            Comparação com o patrimônio total da carteira. Segmentos usam a mesma base de cálculo
            das classes.
          </p>
        </div>

        {carregandoDesvios ? (
          <div aria-busy="true" className="space-y-3">
            <span className="sr-only">Carregando desvios…</span>
            <div className="h-32 animate-pulse rounded-xl bg-neutral-200" />
          </div>
        ) : erroDesvios !== null ? (
          <ErrorState
            title="Desvios indisponíveis"
            message={erroDesvios}
            traceId={traceDesvios}
            onRetry={tentarNovamenteDesvios}
          />
        ) : desvios === null ? null : (
          <>
            {semPatrimonio(desvios) ? (
              <Alert
                tone="info"
                title="Sem patrimônio cadastrado"
                action={
                  <Link href="/ativos/novo" className={ESTILO_BOTAO_SECUNDARIO}>
                    Cadastrar ativo
                  </Link>
                }
              >
                <p>
                  Os percentuais atuais aparecem como 0% até existir um ativo ou saldo na carteira.
                  A configuração de metas continua disponível acima.
                </p>
              </Alert>
            ) : null}

            {possuiValorIndisponivel(desvios) ? (
              <Alert tone="warning" title="Valores pelo custo de aquisição">
                <p>
                  Itens marcados como &quot;Valor pelo custo&quot; não têm cotação de mercado; o
                  percentual atual usa o custo de aquisição como referência.
                </p>
              </Alert>
            ) : null}

            <TabelaDesvios titulo="Desvios por classe" itens={itensClasse} nomes={nomes} />
            <TabelaDesvios titulo="Desvios por segmento" itens={itensSegmento} nomes={nomes} />
          </>
        )}
        </section>
      ) : null}

      <Dialog
        open={confirmacaoAberta}
        title="Salvar novas metas"
        onClose={() => {
          if (!salvando) {
            setConfirmacaoAberta(false);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmacaoAberta(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={confirmarSalvamento} carregando={salvando}>
              Salvar metas
            </Button>
          </>
        }
      >
        <p>
          A configuração atual passa para o histórico e as novas metas passam a valer a partir de
          hoje. Os desvios serão recalculados com base no patrimônio total.
        </p>
      </Dialog>
    </div>
  );
}
