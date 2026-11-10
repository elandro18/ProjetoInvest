"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TextField } from "@/src/components/ui/text-field";
import { TextareaField } from "@/src/components/ui/textarea-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import type { DecisaoAporteApi, SugestaoAporteApi } from "@/src/modules/aportes/apresentacao";
import type { AtivoAvaliado, LinhaDistribuicaoSugerida } from "@/src/modules/aportes/tipos";
import {
  ATALHOS_VALOR,
  ROTULOS_DECISAO,
  TONS_DECISAO,
  ehDecisaoAporte,
  exibirChecklist,
  formatarDataHora,
  formatarEntradaValor,
  formatarMoeda,
  linhasComAporte,
  rotuloClassificacao,
  rotuloReferencia,
  semPatrimonio,
  somarDistribuicao,
  validarValorDisponivel,
  valorParaApi,
  type DecisaoAporte,
  type DecisaoRegistrada,
} from "./aportes-ui";

const ESTILO_LINK_BOTAO =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50";

const TITULOS_DECISAO: Readonly<Record<DecisaoAporte, string>> = {
  ACEITA: "Aceitar sugestão",
  IGNORADA: "Ignorar sugestão",
  ALTERADA: "Alterar sugestão",
};

const DESCRICOES_DECISAO: Readonly<Record<DecisaoAporte, string>> = {
  ACEITA:
    "Registra que você aceitou esta distribuição como referência. O sistema não compra nem vende: a execução do aporte é sua.",
  IGNORADA:
    "Registra que você optou por não seguir esta sugestão. Ela continua no histórico e nada é alterado na carteira.",
  ALTERADA:
    "Registra que você pretende adaptar a distribuição antes de aportar. A sugestão original permanece como referência.",
};

const CONFIRMACOES_DECISAO: Readonly<Record<DecisaoAporte, string>> = {
  ACEITA: "Registrar aceite",
  IGNORADA: "Registrar que ignorei",
  ALTERADA: "Registrar alteração",
};

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

/** Aviso permanente da tela (UI_SPEC §10, §20): sugestão não é recomendação de compra. */
function AvisoPermanente() {
  return (
    <Alert tone="info" title="Sugestão de distribuição — a decisão é sua">
      <p>
        O sistema não compra nem vende por você. A distribuição abaixo é uma referência calculada a
        partir das suas metas; a execução do aporte é sua.
      </p>
    </Alert>
  );
}

interface DistribuicaoProps {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly linhas: readonly LinhaDistribuicaoSugerida[];
}

/**
 * Distribuição sugerida de um escopo (classe ou segmento).
 *
 * Tabela no desktop e cartões abaixo de 768 px (UI_SPEC §15, §19); a
 * justificativa acompanha cada linha, nunca só o valor.
 */
function Distribuicao({ id, titulo, descricao, linhas }: DistribuicaoProps) {
  const tituloId = `${id}-titulo`;

  return (
    <section aria-labelledby={tituloId} className="space-y-2">
      <div className="space-y-1">
        <h3 id={tituloId} className="text-base font-semibold text-neutral-900">
          {titulo}
        </h3>
        <p className="text-sm text-neutral-700">{descricao}</p>
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">
            {`${titulo}: referência, valor sugerido e justificativa de cada linha.`}
          </caption>
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Referência
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                Valor sugerido
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Justificativa
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr
                key={linha.codigo}
                className="border-b border-neutral-200 align-top last:border-b-0"
              >
                <th scope="row" className="max-w-48 px-3 py-3 text-left font-medium text-neutral-900">
                  {rotuloReferencia(linha.codigo)}
                </th>
                <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-900">
                  {formatarMoeda(linha.valor)}
                </td>
                <td className="px-3 py-3 text-neutral-700">{linha.justificativa}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200 bg-neutral-50">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-neutral-900">
                Total
              </th>
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-neutral-900">
                {formatarMoeda(somarDistribuicao(linhas))}
              </td>
              <td className="px-3 py-2 text-neutral-700">Soma exata do valor disponível.</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {linhas.map((linha) => (
          <li
            key={linha.codigo}
            className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-words font-semibold text-neutral-900">
                {rotuloReferencia(linha.codigo)}
              </p>
              <p className="font-semibold text-neutral-900">{formatarMoeda(linha.valor)}</p>
            </div>
            <p className="mt-2 text-sm text-neutral-700">{linha.justificativa}</p>
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="font-semibold text-neutral-900">Total</span>
          <span className="font-semibold text-neutral-900">
            {formatarMoeda(somarDistribuicao(linhas))}
          </span>
        </li>
      </ul>
    </section>
  );
}

function DetalheSegmento({
  linhas,
}: {
  readonly linhas: readonly LinhaDistribuicaoSugerida[];
}) {
  const comAporte = linhasComAporte(linhas);

  if (comAporte.length === 0) {
    return (
      <section aria-labelledby="aportes-distribuicao-segmento-titulo" className="space-y-1">
        <h3
          id="aportes-distribuicao-segmento-titulo"
          className="text-base font-semibold text-neutral-900"
        >
          Distribuição sugerida por segmento
        </h3>
        <p className="text-sm text-neutral-700">
          Nenhum valor foi direcionado aos segmentos neste aporte: o detalhamento por segmento
          aparece quando a parcela de FII recebe aporte.
        </p>
      </section>
    );
  }

  return (
    <Distribuicao
      id="aportes-distribuicao-segmento"
      titulo="Distribuição sugerida por segmento"
      descricao="Detalhamento dentro da parcela de cada classe, com a justificativa do cálculo."
      linhas={comAporte}
    />
  );
}

function ChecklistDoAtivo({ ativo }: { readonly ativo: AtivoAvaliado }) {
  const itens = exibirChecklist(ativo.checklist);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-neutral-900">Checklist</h4>
      <ul className="grid gap-2 sm:grid-cols-2">
        {itens.map((item) => {
          const explicacaoId = `${ativo.ativoId}-${item.chave}-motivo`;

          return (
            <li
              key={item.chave}
              className="rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words text-sm text-neutral-900">{item.rotulo}</span>
                <span
                  title={item.explicacao ?? undefined}
                  aria-describedby={item.explicacao === null ? undefined : explicacaoId}
                >
                  <StatusBadge tone={item.tone}>{item.valor}</StatusBadge>
                </span>
              </div>
              {item.explicacao === null ? null : (
                <p id={explicacaoId} className="mt-1 text-xs text-neutral-500">
                  {item.explicacao}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AtivoParaEstudo({ ativo }: { readonly ativo: AtivoAvaliado }) {
  const classificacao = rotuloClassificacao(ativo.classificacao);
  const local = [
    rotuloReferencia(ativo.classe),
    ativo.segmento === null ? null : rotuloReferencia(ativo.segmento),
  ]
    .filter((valor): valor is string => valor !== null)
    .join(" · ");

  return (
    <li className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h4 className="break-words text-base font-semibold text-neutral-900">
            {`${ativo.ticker} — ${ativo.nome}`}
          </h4>
          <p className="break-words text-sm text-neutral-700">{local}</p>
        </div>
        <StatusBadge tone={classificacao.tone}>{classificacao.texto}</StatusBadge>
      </div>

      {ativo.motivos.length === 0 ? null : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {ativo.motivos.map((motivo) => (
            <li key={motivo}>{motivo}</li>
          ))}
        </ul>
      )}

      <ChecklistDoAtivo ativo={ativo} />
    </li>
  );
}

export interface AportesViewProps {
  /** Injetável nos testes; default = agora (data informada no `POST`). */
  readonly hoje?: string;
}

/**
 * Tela de aportes (UI_SPEC §10; RN-025, RN-026, RN-027, RN-051).
 *
 * Entrada de valor com atalhos → `POST /api/aportes/sugestao` → distribuição
 * por classe/segmento com justificativa, ativos para estudar com checklist e
 * classificação, alertas e decisão (`PATCH /decisao`). A sugestão nunca é
 * apagada: registrar a decisão só acrescenta o estado da decisão à tela.
 */
export function AportesView({ hoje }: AportesViewProps) {
  const [valor, setValor] = useState("");
  const [erroValor, setErroValor] = useState<string | null>(null);

  const [gerando, setGerando] = useState(false);
  const [sugestao, setSugestao] = useState<SugestaoAporteApi | null>(null);
  const [erroSugestao, setErroSugestao] = useState<string | null>(null);
  const [traceSugestao, setTraceSugestao] = useState<string | null>(null);
  const [semDadosParaSugerir, setSemDadosParaSugerir] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  const [decisao, setDecisao] = useState<DecisaoRegistrada | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acao, setAcao] = useState<DecisaoAporte | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);

  const resultadoRef = useRef<HTMLHeadingElement>(null);
  const ultimoValorRef = useRef<string>("1000.00");

  useEffect(() => {
    if (sugestao !== null) {
      resultadoRef.current?.focus();
    }
  }, [sugestao]);

  async function solicitarSugestao(valorContrato: string) {
    setGerando(true);
    setErroSugestao(null);
    setTraceSugestao(null);
    setSemDadosParaSugerir(false);
    setSessaoExpirada(false);
    setFeedback(null);
    ultimoValorRef.current = valorContrato;

    try {
      const resultado = await apiRequest<SugestaoAporteApi>("/api/aportes/sugestao", {
        method: "POST",
        body: {
          valorDisponivel: valorContrato,
          ...(hoje === undefined ? {} : { data: hoje }),
        },
      });

      if (resultado.ok) {
        setSugestao(resultado.data);
        setDecisao(null);
        return;
      }

      if (resultado.status === 409) {
        // APORTE_DADOS_INSUFICIENTES / APORTE_SEM_METAS: sem metas não há
        // distribuição para calcular — a tela orienta a configurar em /alocacao.
        setSugestao(null);
        setSemDadosParaSugerir(true);
        return;
      }

      if (resultado.error.code === "APORTE_VALOR_INVALIDO") {
        setErroValor(mensagemDeErro(resultado.error));
        return;
      }

      setSugestao(null);
      if (ehErroDeSessao(resultado.error)) {
        setSessaoExpirada(true);
      }
      setErroSugestao(mensagemDeErro(resultado.error));
      setTraceSugestao(lerTraceId(resultado.error));
    } catch {
      setSugestao(null);
      setErroSugestao(
        "Não foi possível gerar a sugestão. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setGerando(false);
    }
  }

  function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const erro = validarValorDisponivel(valor);
    if (erro !== null) {
      setErroValor(erro);
      return;
    }

    const valorContrato = valorParaApi(valor);
    if (valorContrato === null) {
      setErroValor("Informe um valor válido (ex.: 1.234,56).");
      return;
    }

    setErroValor(null);
    void solicitarSugestao(valorContrato);
  }

  function tentarNovamente() {
    setSessaoExpirada(false);
    void solicitarSugestao(ultimoValorRef.current);
  }

  function escolherAtalho(valorContrato: string) {
    setValor(formatarEntradaValor(valorContrato));
    setErroValor(null);
  }

  function abrirDecisao(proxima: DecisaoAporte) {
    setErroDecisao(null);
    setObservacoes(decisao?.observacoes ?? "");
    setAcao(proxima);
  }

  async function registrarDecisao() {
    if (sugestao === null || acao === null) {
      return;
    }

    setRegistrando(true);
    setErroDecisao(null);
    const observacao = observacoes.trim();

    try {
      const resultado = await apiRequest<DecisaoAporteApi>(
        `/api/aportes/${sugestao.id}/decisao`,
        {
          method: "PATCH",
          body: {
            decisao: acao,
            ...(observacao === "" ? {} : { observacoes: observacao }),
          },
        },
      );

      if (resultado.ok) {
        const registrada = ehDecisaoAporte(resultado.data.decisaoUsuario)
          ? resultado.data.decisaoUsuario
          : acao;
        setDecisao({
          decisao: registrada,
          em: resultado.data.decisaoEm ?? new Date().toISOString(),
          observacoes: resultado.data.observacoes,
        });
        setAcao(null);
        setFeedback(
          `Decisão registrada: ${ROTULOS_DECISAO[registrada].toLowerCase()}. A sugestão continua disponível nesta tela.`,
        );
        return;
      }

      if (ehErroDeSessao(resultado.error)) {
        setSessaoExpirada(true);
      }
      setErroDecisao(mensagemDeErro(resultado.error));
    } catch {
      setErroDecisao("Não foi possível registrar a decisão. Tente novamente.");
    } finally {
      setRegistrando(false);
    }
  }

  const ativos = sugestao?.ativosAvaliados ?? [];
  const temPatrimonio = sugestao === null ? false : !semPatrimonio(sugestao);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Aportes</h1>
        <p className="text-sm text-neutral-700">
          Informe quanto você pretende aportar para ver onde esse valor reduz mais o desvio em
          relação às suas metas.
        </p>
      </div>

      <AvisoPermanente />

      <form onSubmit={gerar} noValidate className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
        <TextField
          id="aportes-valor"
          label="Valor disponível (R$)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={valor}
          hint="Use vírgula para os centavos — ex.: 1.000,00."
          error={erroValor ?? undefined}
          onChange={(evento) => {
            setValor(evento.target.value);
            setErroValor(null);
          }}
          onBlur={() => {
            if (valor.trim() !== "") {
              setErroValor(validarValorDisponivel(valor));
            }
          }}
        />

        <div className="space-y-2">
          <p id="aportes-atalhos" className="text-sm font-medium text-neutral-900">
            Valores rápidos
          </p>
          <div className="flex flex-wrap gap-2">
            {ATALHOS_VALOR.map((atalho) => (
              <Button
                key={atalho.valor}
                variant="secondary"
                className="px-3 py-1.5"
                aria-describedby="aportes-atalhos"
                onClick={() => escolherAtalho(atalho.valor)}
              >
                {atalho.rotulo}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" carregando={gerando}>
            Gerar sugestão
          </Button>
        </div>
      </form>

      {gerando ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Calculando a sugestão de distribuição…</span>
          <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-28 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      ) : null}

      {semDadosParaSugerir ? (
        <Alert
          tone="warning"
          title="Sem metas para calcular a sugestão"
          action={
            <Link href="/alocacao" className={ESTILO_LINK_BOTAO}>
              Configurar metas em /alocacao
            </Link>
          }
        >
          <p>
            A sugestão compara a carteira com as metas por classe e por segmento. Ajuste as metas e
            gere novamente.
          </p>
        </Alert>
      ) : null}

      {erroSugestao === null ? null : (
        <ErrorState
          title="Não foi possível gerar a sugestão"
          message={erroSugestao}
          traceId={traceSugestao}
          onRetry={sessaoExpirada ? undefined : tentarNovamente}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Faportes" className={ESTILO_LINK_BOTAO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      )}

      {feedback === null ? null : (
        <Alert
          tone="success"
          title="Decisão registrada"
          action={
            <Button variant="ghost" onClick={() => setFeedback(null)}>
              Fechar
            </Button>
          }
        >
          <p>{feedback}</p>
        </Alert>
      )}

      {sugestao === null ? null : (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2
              ref={resultadoRef}
              tabIndex={-1}
              className="text-xl font-semibold text-neutral-900"
            >
              {`Sugestão para ${formatarMoeda(sugestao.valorDisponivel)}`}
            </h2>
            <p className="text-sm text-neutral-700">
              {`Gerada em ${formatarDataHora(sugestao.data)}. Nenhum valor é aplicado à carteira.`}
            </p>
          </div>

          {temPatrimonio ? null : (
            <Alert
              tone="warning"
              title="Sem patrimônio cadastrado"
              action={
                <div className="flex flex-wrap gap-2">
                  <Link href="/ativos/novo" className={ESTILO_LINK_BOTAO}>
                    Cadastrar ativo
                  </Link>
                  <Link href="/renda-fixa" className={ESTILO_LINK_BOTAO}>
                    Cadastrar renda fixa
                  </Link>
                </div>
              }
            >
              <p>
                Sua carteira ainda não tem posições, então os percentuais atuais aparecem como 0% e a
                sugestão usa apenas as metas. Cadastre um ativo ou um título de renda fixa para
                comparar com o patrimônio.
              </p>
            </Alert>
          )}

          <Distribuicao
            id="aportes-distribuicao-classe"
            titulo="Distribuição sugerida por classe"
            descricao="Quanto do aporte vai para cada classe, com a justificativa do cálculo."
            linhas={sugestao.distribuicaoSugerida.classe}
          />

          {sugestao.distribuicaoSugerida.segmento.length === 0 ? null : (
            <DetalheSegmento linhas={sugestao.distribuicaoSugerida.segmento} />
          )}

          <section aria-labelledby="aportes-ativos-titulo" className="space-y-3">
            <div className="space-y-1">
              <h3 id="aportes-ativos-titulo" className="text-base font-semibold text-neutral-900">
                Ativos para estudar
              </h3>
              <p className="text-sm text-neutral-700">
                Ativos da sua carteira que podem ser estudados para este aporte. Não é recomendação
                de compra.
              </p>
            </div>

            {ativos.length === 0 ? (
              <EmptyState
                title="Nenhum ativo cadastrado para avaliar"
                description="Cadastre os ativos que você acompanha para vê-los aqui com classificação e checklist."
                action={
                  <Link href="/ativos/novo" className={ESTILO_LINK_BOTAO}>
                    Cadastrar ativo
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {ativos.map((ativo) => (
                  <AtivoParaEstudo key={ativo.ativoId} ativo={ativo} />
                ))}
              </ul>
            )}
          </section>

          {sugestao.alertas.length === 0 ? null : (
            <Alert tone="warning" title="Alertas da sugestão">
              <ul className="list-disc space-y-1 pl-5">
                {sugestao.alertas.map((alerta) => (
                  <li key={alerta}>{alerta}</li>
                ))}
              </ul>
            </Alert>
          )}

          <section
            aria-labelledby="aportes-decisao-titulo"
            className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 id="aportes-decisao-titulo" className="text-base font-semibold text-neutral-900">
                  Sua decisão
                </h3>
                <p className="text-sm text-neutral-700">
                  Registrar a decisão não altera a carteira e não apaga a sugestão.
                </p>
              </div>
              {decisao === null ? null : (
                <StatusBadge tone={TONS_DECISAO[decisao.decisao]}>
                  {ROTULOS_DECISAO[decisao.decisao]}
                </StatusBadge>
              )}
            </div>

            {decisao === null ? null : (
              <div className="space-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <p>{`Decisão registrada em ${formatarDataHora(decisao.em)}.`}</p>
                {decisao.observacoes === null ? null : (
                  <p className="break-words">{`Observação: ${decisao.observacoes}`}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => abrirDecisao("ACEITA")}>Aceitar</Button>
              <Button variant="secondary" onClick={() => abrirDecisao("IGNORADA")}>
                Ignorar
              </Button>
              <Button variant="secondary" onClick={() => abrirDecisao("ALTERADA")}>
                Alterar
              </Button>
            </div>
          </section>
        </div>
      )}

      <Dialog
        open={acao !== null}
        title={TITULOS_DECISAO[acao ?? "ACEITA"]}
        initialFocusId="aportes-observacoes"
        onClose={() => {
          if (!registrando) {
            setAcao(null);
          }
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcao(null)} disabled={registrando}>
              Cancelar
            </Button>
            <Button onClick={registrarDecisao} carregando={registrando}>
              {CONFIRMACOES_DECISAO[acao ?? "ACEITA"]}
            </Button>
          </>
        }
      >
        <p>{DESCRICOES_DECISAO[acao ?? "ACEITA"]}</p>
        <TextareaField
          id="aportes-observacoes"
          label="Observação (opcional)"
          hint="Fica registrada junto com a decisão, até 1000 caracteres."
          maxLength={1000}
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
        />
        {erroDecisao === null ? null : (
          <p role="alert" className="text-sm font-medium text-negative">
            {erroDecisao}
          </p>
        )}
      </Dialog>
    </div>
  );
}
