import { Decimal } from "@/src/lib/decimal";
import { StatusBadge, type StatusBadgeTone } from "@/src/components/ui/status-badge";

import {
  descreverMeta,
  formatarMoeda,
  formatarPercentual,
  larguraDaBarra,
  linhasMeta,
  posicaoDaMarca,
  ROTULOS_SITUACAO,
  type IndicadoresApi,
  type LinhaMeta,
  type SituacaoDesvio,
} from "./dashboard-ui";

/**
 * Cards de resumo e comparação com a meta (RN-061-3; UI_SPEC §4, §15).
 *
 * Cada card é um par rótulo/valor em `<dl>` — o leitor de tela anuncia
 * "Patrimônio total: R$ …" sem depender do layout. Percentual e resultado
 * sempre trazem texto de apoio; a cor é reforço, nunca o único portador
 * (UI_SPEC §18).
 */

interface CardIndicador {
  readonly rotulo: string;
  readonly valor: string;
  readonly apoio?: string;
  readonly tom?: "positive" | "negative" | "neutral";
}

const TONS_TEXTO = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-neutral-700",
} as const;

function tomDoResultado(valor: string): CardIndicador["tom"] {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok || parsed.value.isZero()) {
    return "neutral";
  }
  return parsed.value.isNegative() ? "negative" : "positive";
}

function apoioDoResultado(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok || parsed.value.isZero()) {
    return "Sem resultado acumulado";
  }
  return parsed.value.isNegative() ? "Resultado negativo" : "Resultado positivo";
}

export function cardsIndicadores(indicadores: IndicadoresApi): readonly CardIndicador[] {
  return [
    { rotulo: "Patrimônio total", valor: formatarMoeda(indicadores.patrimonioTotal) },
    { rotulo: "Total investido", valor: formatarMoeda(indicadores.totalInvestido) },
    { rotulo: "Valor atual", valor: formatarMoeda(indicadores.valorAtual) },
    {
      rotulo: "Resultado acumulado",
      valor: formatarMoeda(indicadores.resultadoAcumulado),
      apoio: apoioDoResultado(indicadores.resultadoAcumulado),
      tom: tomDoResultado(indicadores.resultadoAcumulado),
    },
    { rotulo: "Renda mensal", valor: formatarMoeda(indicadores.rendaMensal) },
    { rotulo: "Rendimentos no ano", valor: formatarMoeda(indicadores.rendimentosAno) },
    {
      rotulo: "% em renda fixa",
      valor: formatarPercentual(indicadores.percentualRendaFixa),
      apoio: "do patrimônio total",
    },
    {
      rotulo: "% em FIIs",
      valor: formatarPercentual(indicadores.percentualFiis),
      apoio: "do patrimônio total",
    },
  ];
}

export function CardsResumo({ indicadores }: { readonly indicadores: IndicadoresApi }) {
  const cards = cardsIndicadores(indicadores);

  return (
    <section aria-labelledby="dashboard-cards-titulo" className="space-y-3">
      <h2 id="dashboard-cards-titulo" className="text-lg font-semibold text-neutral-900">
        Resumo da carteira
      </h2>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.rotulo}
            className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
          >
            <dt className="text-sm font-medium text-neutral-700">{card.rotulo}</dt>
            <dd className="mt-1 text-xl font-semibold break-words text-neutral-900">
              {card.valor}
            </dd>
            {card.apoio === undefined ? null : (
              <dd
                className={[
                  "mt-1 text-xs font-medium",
                  TONS_TEXTO[card.tom ?? "neutral"],
                ].join(" ")}
              >
                {card.apoio}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

const TONS_SITUACAO: Readonly<Record<SituacaoDesvio, StatusBadgeTone>> = {
  ABAIXO: "warning",
  ACIMA: "info",
  DENTRO: "success",
};

const CORES_BARRA: Readonly<Record<string, string>> = {
  RENDA_FIXA: "var(--info)",
  FII: "var(--positive)",
  CAIXA_OPORTUNIDADES: "var(--neutral-500)",
};

function corDaBarra(codigo: string): string {
  return CORES_BARRA[codigo] ?? "var(--warning)";
}

function LinhaBarra({ linha }: { readonly linha: LinhaMeta }) {
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-900">{linha.rotulo}</span>
        <StatusBadge tone={TONS_SITUACAO[linha.situacao]}>
          {ROTULOS_SITUACAO[linha.situacao]}
        </StatusBadge>
      </div>

      <div
        className="relative h-3 w-full rounded-full bg-neutral-100"
        role="img"
        aria-label={descreverMeta(linha)}
      >
        <div
          className="h-3 rounded-full"
          style={{
            width: `${larguraDaBarra(linha.atual)}%`,
            backgroundColor: corDaBarra(linha.codigo),
          }}
        />
        <span
          aria-hidden="true"
          className="absolute top-[-4px] h-5 w-0.5 rounded-full bg-neutral-900"
          style={{ left: `${posicaoDaMarca(linha.meta)}%` }}
        />
      </div>

      <p className="text-sm text-neutral-700">{descreverMeta(linha)}</p>
    </li>
  );
}

/**
 * `AllocationBar` da tela: barra atual + marca da meta + rótulo textual.
 * A marca é puramente visual; o mesmo número aparece por extenso na linha.
 */
export function BarraAlocacaoMeta({
  indicadores,
}: {
  readonly indicadores: IndicadoresApi;
}) {
  const linhas = linhasMeta(indicadores);

  return (
    <section
      aria-labelledby="dashboard-meta-titulo"
      className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
    >
      <div className="space-y-1">
        <h2 id="dashboard-meta-titulo" className="text-lg font-semibold text-neutral-900">
          Comparação com a meta
        </h2>
        <p className="text-sm text-neutral-700">
          A marca vertical indica a meta; o texto abaixo de cada barra traz o percentual atual,
          a meta e o desvio em pontos percentuais.
        </p>
      </div>

      <ul className="space-y-4">
        {linhas.map((linha) => (
          <LinhaBarra key={linha.codigo} linha={linha} />
        ))}
      </ul>
    </section>
  );
}
