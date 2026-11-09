import type { ReactNode } from "react";

import { StatusBadge } from "@/src/components/ui/status-badge";

import {
  distribuicaoVazia,
  dividendosVisiveis,
  evolucaoPatrimonialVazia,
  evolucaoRendimentosVazia,
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarPercentual,
  larguraDaBarra,
  maiorValor,
  rotuloMes,
  valorNumerico,
  type DividendoApi,
  type ItemDistribuicaoApi,
  type PontoEvolucaoPatrimonialApi,
  type PontoEvolucaoRendimentosApi,
} from "./dashboard-ui";

/**
 * Gráficos do dashboard em SVG acessível (RN-061-3; UI_SPEC §4, §15, §18).
 *
 * Não há biblioteca de gráficos: as séries já vêm prontas do backend e aqui
 * só existe geometria de apresentação. Cada gráfico tem uma tabela equivalente
 * em `<details>` — navegável por teclado — e a legenda textual nunca depende
 * da cor. Em 360 px o SVG usa `viewBox` e ocupa 100% da largura, sem overflow.
 */

const CORES_SERIE = [
  "var(--info)",
  "var(--positive)",
  "var(--warning)",
  "var(--neutral-500)",
  "var(--neutral-700)",
  "var(--neutral-200)",
] as const;

function corDaSerie(indice: number): string {
  return CORES_SERIE[indice % CORES_SERIE.length] ?? "var(--info)";
}

// ---------------------------------------------------------------------------
// Estrutura comum
// ---------------------------------------------------------------------------

interface ColunaTabela {
  readonly rotulo: string;
  readonly alinhamento?: "left" | "right";
}

interface TabelaEquivalenteProps {
  readonly titulo: string;
  readonly colunas: readonly ColunaTabela[];
  readonly linhas: readonly (readonly ReactNode[])[];
}

function TabelaEquivalente({ titulo, colunas, linhas }: TabelaEquivalenteProps) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <caption className="px-3 py-2 text-left text-sm font-semibold text-neutral-700">
          {titulo}
        </caption>
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.rotulo}
                scope="col"
                className={[
                  "px-3 py-2 font-semibold text-neutral-700",
                  coluna.alinhamento === "right" ? "text-right" : "",
                ].join(" ")}
              >
                {coluna.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => (
            <tr key={indice} className="border-b border-neutral-200 last:border-b-0">
              {linha.map((celula, coluna) => (
                <td
                  key={coluna}
                  className={[
                    "px-3 py-2 align-top text-neutral-900",
                    colunas[coluna]?.alinhamento === "right" ? "text-right" : "",
                  ].join(" ")}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CartaoGraficoProps {
  readonly id: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly children: ReactNode;
  readonly tabela?: ReactNode;
}

function CartaoGrafico({ id, titulo, descricao, children, tabela }: CartaoGraficoProps) {
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4"
    >
      <div className="space-y-1">
        <h3 id={`${id}-titulo`} className="text-base font-semibold text-neutral-900">
          {titulo}
        </h3>
        {descricao === undefined ? null : (
          <p className="text-sm text-neutral-700">{descricao}</p>
        )}
      </div>

      {children}

      {tabela === undefined ? null : (
        <details className="rounded-lg">
          <summary className="cursor-pointer text-sm font-medium text-info hover:underline">
            Ver dados em tabela
          </summary>
          {tabela}
        </details>
      )}
    </section>
  );
}

function SemDados({ children }: { readonly children: string }) {
  return <p className="rounded-lg bg-neutral-50 px-3 py-4 text-sm text-neutral-700">{children}</p>;
}

/** Bloco de recurso de fase futura (Fase 2/4) — nunca quebra a tela. */
export function BlocoEmBreve({
  titulo,
  descricao,
}: {
  readonly titulo: string;
  readonly descricao: string;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-900">{titulo}</h3>
        <StatusBadge tone="neutral">Disponível em breve</StatusBadge>
      </div>
      <p className="text-sm text-neutral-700">{descricao}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Donut por classe
// ---------------------------------------------------------------------------

interface Arco {
  readonly item: ItemDistribuicaoApi;
  readonly inicio: number;
  readonly fim: number;
  readonly cor: string;
}

const CENTRO = 16;
const RAIO = 14;

function coordenada(anguloGraus: number): readonly [number, number] {
  const radianos = ((anguloGraus - 90) * Math.PI) / 180;
  return [
    CENTRO + RAIO * Math.cos(radianos),
    CENTRO + RAIO * Math.sin(radianos),
  ];
}

function montarArcos(itens: readonly ItemDistribuicaoApi[]): readonly Arco[] {
  let acumulado = 0;

  return itens
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => valorNumerico(item.percentual) > 0)
    .map(({ item, indice }) => {
      const percentual = larguraDaBarra(item.percentual);
      const inicio = acumulado;
      acumulado += percentual;
      return { item, inicio, fim: Math.min(100, acumulado), cor: corDaSerie(indice) };
    });
}

function caminhoDoArco(arco: Arco): string {
  const [x1, y1] = coordenada((arco.inicio / 100) * 360);
  const [x2, y2] = coordenada((arco.fim / 100) * 360);
  const arcoMaior = arco.fim - arco.inicio > 50 ? 1 : 0;

  return [
    `M ${CENTRO} ${CENTRO}`,
    `L ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${RAIO} ${RAIO} 0 ${arcoMaior} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export function DonutDistribuicao({
  id,
  titulo,
  descricao,
  itens,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly itens: readonly ItemDistribuicaoApi[];
}) {
  const vazia = distribuicaoVazia(itens);
  const arcos = montarArcos(itens);
  const unico = arcos.length === 1 && (arcos[0]?.fim ?? 0) >= 99.999;
  const resumo = itens
    .map((item) => `${item.nome} ${formatarPercentual(item.percentual)}`)
    .join("; ");

  return (
    <CartaoGrafico
      id={id}
      titulo={titulo}
      descricao={descricao}
      tabela={
        vazia ? undefined : (
          <TabelaEquivalente
            titulo={`${titulo} — dados em tabela`}
            colunas={[
              { rotulo: "Classe" },
              { rotulo: "Valor", alinhamento: "right" },
              { rotulo: "Percentual", alinhamento: "right" },
            ]}
            linhas={itens.map((item) => [
              item.nome,
              formatarMoeda(item.valor),
              formatarPercentual(item.percentual),
            ])}
          />
        )
      }
    >
      {vazia ? (
        <SemDados>Ainda não há distribuição por classe para exibir.</SemDados>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <svg
            viewBox="0 0 32 32"
            role="img"
            aria-label={`${titulo}: ${resumo}`}
            className="h-36 w-36 shrink-0"
          >
            {unico ? (
              <circle cx={CENTRO} cy={CENTRO} r={RAIO} fill={arcos[0]?.cor} />
            ) : (
              arcos.map((arco) => (
                <path
                  key={arco.item.codigo}
                  d={caminhoDoArco(arco)}
                  fill={arco.cor}
                  stroke="var(--neutral-0)"
                  strokeWidth={0.4}
                />
              ))
            )}
            <circle cx={CENTRO} cy={CENTRO} r={8} fill="var(--neutral-0)" />
          </svg>

          <ul className="w-full space-y-1 text-sm">
            {itens.map((item, indice) => (
              <li key={item.codigo} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: corDaSerie(indice) }}
                  />
                  <span className="break-words text-neutral-900">{item.nome}</span>
                </span>
                <span className="text-neutral-700">{formatarPercentual(item.percentual)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CartaoGrafico>
  );
}

// ---------------------------------------------------------------------------
// Barras por segmento
// ---------------------------------------------------------------------------

export function BarrasSegmento({
  id,
  titulo,
  descricao,
  itens,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly itens: readonly ItemDistribuicaoApi[];
}) {
  const vazia = distribuicaoVazia(itens);

  return (
    <CartaoGrafico
      id={id}
      titulo={titulo}
      descricao={descricao}
      tabela={
        vazia ? undefined : (
          <TabelaEquivalente
            titulo={`${titulo} — dados em tabela`}
            colunas={[
              { rotulo: "Segmento" },
              { rotulo: "Valor", alinhamento: "right" },
              { rotulo: "Percentual", alinhamento: "right" },
            ]}
            linhas={itens.map((item) => [
              item.nome,
              formatarMoeda(item.valor),
              formatarPercentual(item.percentual),
            ])}
          />
        )
      }
    >
      {vazia ? (
        <SemDados>Ainda não há distribuição por segmento para exibir.</SemDados>
      ) : (
        <ul className="space-y-3">
          {itens.map((item, indice) => (
            <li key={item.codigo} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="break-words font-medium text-neutral-900">{item.nome}</span>
                <span className="text-neutral-700">{formatarPercentual(item.percentual)}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-neutral-100">
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    width: `${larguraDaBarra(item.percentual)}%`,
                    backgroundColor: corDaSerie(indice),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CartaoGrafico>
  );
}

// ---------------------------------------------------------------------------
// Evolução patrimonial (linha)
// ---------------------------------------------------------------------------

const LARGURA_GRAFICO = 300;
const ALTURA_GRAFICO = 100;
const MARGEM = 8;

function pontosDaLinha(pontos: readonly PontoEvolucaoPatrimonialApi[]): readonly string[] {
  const maximo = maiorValor(pontos.map((ponto) => ponto.patrimonio));
  const larguraUtil = LARGURA_GRAFICO - MARGEM * 2;
  const alturaUtil = ALTURA_GRAFICO - MARGEM * 2;

  return pontos.map((ponto, indice) => {
    const x =
      pontos.length === 1 ? MARGEM + larguraUtil / 2 : MARGEM + (indice / (pontos.length - 1)) * larguraUtil;
    const y =
      maximo === 0 ? ALTURA_GRAFICO - MARGEM : ALTURA_GRAFICO - MARGEM - (valorNumerico(ponto.patrimonio) / maximo) * alturaUtil;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
}

export function LinhaEvolucaoPatrimonial({
  id,
  titulo,
  descricao,
  pontos,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly pontos: readonly PontoEvolucaoPatrimonialApi[];
}) {
  const vazia = evolucaoPatrimonialVazia(pontos);
  const coordenadas = pontosDaLinha(pontos);
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const maximo = maiorValor(pontos.map((ponto) => ponto.patrimonio));

  return (
    <CartaoGrafico
      id={id}
      titulo={titulo}
      descricao={descricao}
      tabela={
        vazia ? undefined : (
          <TabelaEquivalente
            titulo={`${titulo} — dados em tabela`}
            colunas={[
              { rotulo: "Data" },
              { rotulo: "Patrimônio", alinhamento: "right" },
              { rotulo: "Renda fixa", alinhamento: "right" },
              { rotulo: "FIIs", alinhamento: "right" },
            ]}
            linhas={pontos.map((ponto) => [
              formatarData(ponto.data),
              formatarMoeda(ponto.patrimonio),
              formatarMoeda(ponto.rendaFixa),
              formatarMoeda(ponto.fiis),
            ])}
          />
        )
      }
    >
      {vazia ? (
        <SemDados>Ainda não há evolução patrimonial para exibir.</SemDados>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${LARGURA_GRAFICO} ${ALTURA_GRAFICO}`}
            role="img"
            aria-label={`${titulo}: de ${formatarMoeda(primeiro?.patrimonio ?? "0")} em ${
              primeiro === undefined ? "—" : formatarData(primeiro.data)
            } para ${formatarMoeda(ultimo?.patrimonio ?? "0")} em ${
              ultimo === undefined ? "—" : formatarData(ultimo.data)
            }`}
            className="h-32 w-full"
          >
            <line
              x1={MARGEM}
              y1={ALTURA_GRAFICO - MARGEM}
              x2={LARGURA_GRAFICO - MARGEM}
              y2={ALTURA_GRAFICO - MARGEM}
              stroke="var(--neutral-200)"
              strokeWidth={1}
            />
            <text x={MARGEM} y={MARGEM} fontSize={6} fill="var(--neutral-500)">
              {formatarMoeda(maximo.toFixed(2))}
            </text>
            <polyline
              points={coordenadas.join(" ")}
              fill="none"
              stroke="var(--info)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pontos.map((ponto, indice) => {
              const [x, y] = (coordenadas[indice] ?? "0,0").split(",");
              return <circle key={ponto.data} cx={x} cy={y} r={2} fill="var(--info)" />;
            })}
          </svg>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>{primeiro === undefined ? "" : rotuloMes(primeiro.data.slice(0, 7))}</span>
            <span>{ultimo === undefined ? "" : rotuloMes(ultimo.data.slice(0, 7))}</span>
          </div>
        </>
      )}
    </CartaoGrafico>
  );
}

// ---------------------------------------------------------------------------
// Evolução dos rendimentos (barras por mês)
// ---------------------------------------------------------------------------

const ALTURA_BARRAS = 90;
const LARGURA_BARRAS = 300;

function BarrasRendimentosSvg({
  pontos,
}: {
  readonly pontos: readonly PontoEvolucaoRendimentosApi[];
}) {
  const maximo = maiorValor(pontos.map((ponto) => ponto.valor));
  const larguraBarra = (LARGURA_BARRAS - MARGEM * 2) / Math.max(1, pontos.length);
  const alturaUtil = ALTURA_BARRAS - MARGEM * 2 - 8;

  return (
    <svg
      viewBox={`0 0 ${LARGURA_BARRAS} ${ALTURA_BARRAS}`}
      role="img"
      aria-label="Evolução dos rendimentos nos últimos 12 meses"
      className="h-28 w-full"
    >
      {pontos.map((ponto, indice) => {
        const altura =
          maximo === 0 ? 0 : (valorNumerico(ponto.valor) / maximo) * alturaUtil;
        const x = MARGEM + indice * larguraBarra + larguraBarra * 0.15;
        const largura = larguraBarra * 0.7;
        const y = ALTURA_BARRAS - MARGEM - 8 - altura;

        return (
          <g key={ponto.mes}>
            <rect
              x={x.toFixed(2)}
              y={y.toFixed(2)}
              width={largura.toFixed(2)}
              height={Math.max(0, altura).toFixed(2)}
              rx={1}
              fill="var(--positive)"
            />
            {indice % 3 === 0 || indice === pontos.length - 1 ? (
              <text
                x={(x + largura / 2).toFixed(2)}
                y={ALTURA_BARRAS - 2}
                fontSize={6}
                textAnchor="middle"
                fill="var(--neutral-500)"
              >
                {rotuloMes(ponto.mes)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function BarrasRendimentos({
  id,
  titulo,
  descricao,
  pontos,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly pontos: readonly PontoEvolucaoRendimentosApi[];
}) {
  const vazia = evolucaoRendimentosVazia(pontos);

  return (
    <CartaoGrafico
      id={id}
      titulo={titulo}
      descricao={descricao}
      tabela={
        vazia ? undefined : (
          <TabelaEquivalente
            titulo={`${titulo} — dados em tabela`}
            colunas={[{ rotulo: "Mês" }, { rotulo: "Rendimentos", alinhamento: "right" }]}
            linhas={pontos.map((ponto) => [formatarMes(ponto.mes), formatarMoeda(ponto.valor)])}
          />
        )
      }
    >
      {vazia ? (
        <SemDados>Nenhum rendimento recebido nos últimos 12 meses.</SemDados>
      ) : (
        <BarrasRendimentosSvg pontos={pontos} />
      )}
    </CartaoGrafico>
  );
}

// ---------------------------------------------------------------------------
// Histórico de dividendos
// ---------------------------------------------------------------------------

export function HistoricoDividendos({
  id,
  titulo,
  descricao,
  dividendos,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly dividendos: readonly DividendoApi[];
}) {
  const visiveis = dividendosVisiveis(dividendos);

  return (
    <CartaoGrafico id={id} titulo={titulo} descricao={descricao}>
      {visiveis.length === 0 ? (
        <SemDados>Nenhum dividendo recebido ainda.</SemDados>
      ) : (
        <ul aria-label={titulo} className="divide-y divide-neutral-200">
          {visiveis.map((dividendo) => (
            <li
              key={`${dividendo.data}-${dividendo.ativo}-${dividendo.valor}`}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <time dateTime={dividendo.data} className="text-neutral-700">
                  {formatarData(dividendo.data)}
                </time>
                <span className="font-medium text-neutral-900">{dividendo.ativo}</span>
              </span>
              <span className="text-neutral-900">{formatarMoeda(dividendo.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </CartaoGrafico>
  );
}
