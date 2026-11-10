"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { ErrorState } from "@/src/components/ui/error-state";
import { TextField } from "@/src/components/ui/text-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import type { SimulacaoAporteApi } from "@/src/modules/aportes/apresentacao";
import {
  ESTILO_LINK_BOTAO,
  formatarEntradaValor,
  formatarMoeda,
  valorParaApi,
} from "./aportes-ui";
import {
  ATALHOS_SIMULACAO,
  carteiraVazia,
  compararEscopo,
  diferencaPatrimonio,
  formatarPercentualSimulacao,
  larguraBarra,
  validarValorSimulacao,
  type LinhaComparacao,
  type Variacao,
} from "./simulador-ui";

const TOM_VARIACAO: Readonly<Record<Variacao, string>> = {
  aumento: "text-positive",
  reducao: "text-negative",
  "sem-alteracao": "text-neutral-700",
  indisponivel: "text-neutral-700",
};

function lerTraceId(erro: ApiError): string | null {
  const traceId = erro.details?.traceId;
  return typeof traceId === "string" ? traceId : null;
}

function BarraComparacao({
  rotulo,
  percentual,
  tom,
}: {
  readonly rotulo: string;
  readonly percentual: string;
  readonly tom: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-neutral-500">{rotulo}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={["h-full rounded-full", tom].join(" ")}
          style={{ width: `${larguraBarra(percentual)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Linha que não muda nem em valor nem em percentual.
 *
 * A API devolve todas as linhas (RN-028-1) e todas são exibidas; para as que
 * ficam idênticas dos dois lados, um cartão compacto com "antes e depois" no
 * mesmo texto evita sete blocos vazios de segmento sem aporte.
 */
function semMudanca(linha: LinhaComparacao): boolean {
  return (
    linha.variacao === "sem-alteracao" &&
    linha.antes.valor === linha.depois.valor &&
    linha.antes.percentual === linha.depois.percentual
  );
}

/**
 * Uma linha do comparativo: valor e percentual de cada lado, a variação em
 * p.p. com sinal e texto e as barras de antes/depois.
 *
 * As barras são reforço visual (`aria-hidden`): valor, percentual e variação
 * já estão em texto no mesmo item (UI_SPEC §18).
 */
function LinhaComparativo({ linha }: { readonly linha: LinhaComparacao }) {
  if (semMudanca(linha)) {
    return (
      <li className="rounded-xl border border-neutral-200 bg-neutral-0 px-4 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 break-words text-sm font-semibold text-neutral-900">
            {linha.rotulo}
          </p>
          <p className="text-sm text-neutral-700">
            {`${formatarMoeda(linha.antes.valor)} · ${formatarPercentualSimulacao(
              linha.antes.percentual,
            )} · sem alteração`}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 break-words font-semibold text-neutral-900">{linha.rotulo}</p>
        <p className={["text-sm font-semibold", TOM_VARIACAO[linha.variacao]].join(" ")}>
          {linha.deltaTexto}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Antes</dt>
          <dd className="mt-0.5 break-words text-neutral-900">
            {formatarMoeda(linha.antes.valor)}
          </dd>
          <dd className="text-neutral-700">
            {formatarPercentualSimulacao(linha.antes.percentual)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Depois</dt>
          <dd className="mt-0.5 break-words text-neutral-900">
            {formatarMoeda(linha.depois.valor)}
          </dd>
          <dd className="text-neutral-700">
            {formatarPercentualSimulacao(linha.depois.percentual)}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-neutral-700">{linha.deltaExplicacao}</p>

      <div aria-hidden="true" className="space-y-1">
        <BarraComparacao rotulo="Antes" percentual={linha.antes.percentual} tom="bg-neutral-500" />
        <BarraComparacao rotulo="Depois" percentual={linha.depois.percentual} tom="bg-neutral-900" />
      </div>
    </li>
  );
}

function Comparativo({
  id,
  titulo,
  linhas,
  vazio,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly linhas: readonly LinhaComparacao[];
  readonly vazio: string;
}) {
  const tituloId = `${id}-titulo`;

  return (
    <section aria-labelledby={tituloId} className="space-y-2">
      <h3 id={tituloId} className="text-base font-semibold text-neutral-900">
        {titulo}
      </h3>
      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-700">{vazio}</p>
      ) : (
        <ul className="space-y-3">
          {linhas.map((linha) => (
            <LinhaComparativo key={linha.codigo} linha={linha} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultadoSimulacao({ simulacao }: { readonly simulacao: SimulacaoAporteApi }) {
  const classes = compararEscopo(
    simulacao.antes,
    simulacao.depois,
    simulacao.delta,
    "classe",
  );
  const segmentos = compararEscopo(
    simulacao.antes,
    simulacao.depois,
    simulacao.delta,
    "segmento",
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-neutral-900">
          {`Simulação para ${formatarMoeda(simulacao.valorAporte)}`}
        </h3>
        <p className="text-sm text-neutral-700">
          {`Patrimônio de ${formatarMoeda(simulacao.antes.patrimonioTotal)} para ${formatarMoeda(
            simulacao.depois.patrimonioTotal,
          )} (${diferencaPatrimonio(
            simulacao.antes.patrimonioTotal,
            simulacao.depois.patrimonioTotal,
          )}).`}
        </p>
      </div>

      {carteiraVazia(simulacao) ? (
        <Alert tone="info" title="Carteira vazia — simulação a partir das metas">
          <p>
            Sua carteira ainda não tem patrimônio. O antes aparece com 0% e o depois aplica o valor
            simulado segundo as metas de alocação.
          </p>
        </Alert>
      ) : null}

      <Comparativo
        id="aportes-simulador-classe"
        titulo="Antes × depois por classe"
        linhas={classes}
        vazio="Nenhuma classe retornada pela simulação."
      />

      <Comparativo
        id="aportes-simulador-segmento"
        titulo="Antes × depois por segmento"
        linhas={segmentos}
        vazio="Nenhum segmento nas metas vigentes — a comparação fica por classe."
      />
    </div>
  );
}

/**
 * Seção **Simulador** de `/aportes` (RN-028; UI_SPEC §10; API_CONTRACTS §8.2).
 *
 * Stateless por definição: envia o valor hipotético, exibe o comparativo
 * antes × depois por classe e segmento e não toca na carteira — o aviso
 * permanente deixa isso explícito. Bloco separado da sugestão: a simulação
 * nem cria `sugestao_aporte` nem depende de a sugestão ter sido gerada.
 */
export function SimuladorAporte() {
  const [valor, setValor] = useState("");
  const [erroValor, setErroValor] = useState<string | null>(null);

  const [simulando, setSimulando] = useState(false);
  const [simulacao, setSimulacao] = useState<SimulacaoAporteApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [semMetas, setSemMetas] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  const ultimoValorRef = useRef("1000.00");

  async function solicitarSimulacao(valorContrato: string) {
    setSimulando(true);
    setErro(null);
    setTraceId(null);
    setSemMetas(false);
    setSessaoExpirada(false);
    setSimulacao(null);
    ultimoValorRef.current = valorContrato;

    try {
      const resultado = await apiRequest<SimulacaoAporteApi>("/api/aportes/simulacao", {
        method: "POST",
        body: { valorAporte: valorContrato },
      });

      if (resultado.ok) {
        setSimulacao(resultado.data);
        return;
      }

      if (resultado.error.code === "APORTE_VALOR_INVALIDO") {
        setErroValor(mensagemDeErro(resultado.error));
        return;
      }

      if (resultado.status === 409) {
        // APORTE_DADOS_INSUFICIENTES: sem metas não há distribuição para
        // simular — a tela orienta a configurar em /alocacao.
        setSemMetas(true);
        return;
      }

      if (ehErroDeSessao(resultado.error)) {
        setSessaoExpirada(true);
      }
      setErro(mensagemDeErro(resultado.error));
      setTraceId(lerTraceId(resultado.error));
    } catch {
      setErro("Não foi possível simular o aporte. Verifique sua conexão e tente novamente.");
    } finally {
      setSimulando(false);
    }
  }

  function simular(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const validacao = validarValorSimulacao(valor);
    if (validacao !== null) {
      setErroValor(validacao);
      return;
    }

    const valorContrato = valorParaApi(valor);
    if (valorContrato === null) {
      setErroValor("Informe um valor válido (ex.: 1.234,56).");
      return;
    }

    setErroValor(null);
    void solicitarSimulacao(valorContrato);
  }

  function tentarNovamente() {
    setSessaoExpirada(false);
    void solicitarSimulacao(ultimoValorRef.current);
  }

  function escolherAtalho(valorContrato: string) {
    setValor(formatarEntradaValor(valorContrato));
    setErroValor(null);
  }

  return (
    <section aria-labelledby="aportes-simulador-titulo" className="space-y-4">
      <div className="space-y-1">
        <h2 id="aportes-simulador-titulo" className="text-xl font-semibold text-neutral-900">
          Simulador
        </h2>
        <p className="text-sm text-neutral-700">
          Teste “e se eu aportasse R$ 1.500?” e veja como a carteira ficaria depois — por classe e
          por segmento, com a diferença em pontos percentuais.
        </p>
      </div>

      <Alert tone="info" title="Simulação — nada é aplicado à carteira">
        <p>
          O comparativo abaixo é uma projeção calculada com as suas metas. Nenhum valor é comprado,
          vendido ou registrado como movimentação.
        </p>
      </Alert>

      <form
        onSubmit={simular}
        noValidate
        className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
      >
        <TextField
          id="aportes-simulador-valor"
          label="Valor a simular (R$)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={valor}
          hint="Escolha um valor rápido ou digite outro — ex.: 1.500,00."
          error={erroValor ?? undefined}
          onChange={(evento) => {
            setValor(evento.target.value);
            setErroValor(null);
          }}
          onBlur={() => {
            if (valor.trim() !== "") {
              setErroValor(validarValorSimulacao(valor));
            }
          }}
        />

        <div className="space-y-2">
          <p id="aportes-simulador-atalhos" className="text-sm font-medium text-neutral-900">
            Valores rápidos
          </p>
          <div className="flex flex-wrap gap-2">
            {ATALHOS_SIMULACAO.map((atalho) => (
              <Button
                key={atalho.valor}
                variant="secondary"
                className="px-3 py-1.5"
                aria-label={`Simular ${atalho.rotulo}`}
                aria-describedby="aportes-simulador-atalhos"
                onClick={() => escolherAtalho(atalho.valor)}
              >
                {atalho.rotulo}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" carregando={simulando}>
            Simular
          </Button>
        </div>
      </form>

      {simulando ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Calculando a simulação…</span>
          <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      ) : null}

      {semMetas ? (
        <Alert
          tone="warning"
          title="Sem metas para simular"
          action={
            <Link href="/alocacao" className={ESTILO_LINK_BOTAO}>
              Configurar metas em /alocacao
            </Link>
          }
        >
          <p>
            A simulação distribui o valor conforme as metas por classe e por segmento. Configure as
            metas e simule novamente.
          </p>
        </Alert>
      ) : null}

      {erro === null ? null : (
        <ErrorState
          title="Não foi possível simular o aporte"
          message={erro}
          traceId={traceId}
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

      <div aria-live="polite">
        {simulacao === null ? null : <ResultadoSimulacao simulacao={simulacao} />}
      </div>
    </section>
  );
}
