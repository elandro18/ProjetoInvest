import { Decimal } from "@/src/lib/decimal";

/**
 * Tipos e regras de forma da tela de dashboard (RN-061-3/4/5; UI_SPEC §4).
 *
 * O contrato (`API_CONTRACTS.md §5.3`) entrega dinheiro e percentual como
 * string decimal; nada aqui converte valor financeiro para `number`. A
 * geometria dos gráficos é a única exceção — ela transforma o percentual em
 * coordenada visual, nunca em decisão.
 *
 * A comparação com a meta reaproveita o desvio calculado pelo servidor
 * (RN-021-3). Quando o titular ainda não configurou metas, o painel cai no
 * padrão 50/50 exigido pela UI_SPEC §4 — o desvio é derivado com `Decimal`,
 * com a mesma tolerância de 0,5 p.p. do domínio (`src/modules/alocacao/metas`).
 */

export type EscopoMeta = "CLASSE" | "SEGMENTO";
export type SituacaoDesvio = "ABAIXO" | "ACIMA" | "DENTRO";
export type NomeBlocoDashboard = "indicadores" | "graficos" | "oportunidades";

export interface MetaIndicadorApi {
  readonly codigo: string;
  readonly atual: string;
  readonly meta: string;
  readonly desvio: string;
  readonly situacao: SituacaoDesvio;
}

export interface IndicadoresApi {
  readonly vazio: boolean;
  readonly patrimonioTotal: string;
  readonly totalInvestido: string;
  readonly valorAtual: string;
  readonly resultadoAcumulado: string;
  readonly rendaMensal: string;
  readonly rendimentosAno: string;
  readonly percentualRendaFixa: string;
  readonly percentualFiis: string;
  readonly meta: readonly MetaIndicadorApi[];
}

export interface ItemDistribuicaoApi {
  readonly codigo: string;
  readonly nome: string;
  readonly valor: string;
  readonly percentual: string;
  readonly valorIndisponivel: boolean;
}

export interface PontoEvolucaoPatrimonialApi {
  readonly data: string;
  readonly patrimonio: string;
  readonly rendaFixa: string;
  readonly fiis: string;
}

export interface PontoEvolucaoRendimentosApi {
  readonly mes: string;
  readonly valor: string;
}

export interface DividendoApi {
  readonly data: string;
  readonly ativo: string;
  readonly valor: string;
}

export interface GraficosApi {
  readonly porClasse: readonly ItemDistribuicaoApi[];
  readonly porSegmento: readonly ItemDistribuicaoApi[];
  readonly evolucaoPatrimonial: readonly PontoEvolucaoPatrimonialApi[];
  readonly evolucaoRendimentos: readonly PontoEvolucaoRendimentosApi[];
  readonly aportes: readonly unknown[];
  readonly dividendos: readonly DividendoApi[];
}

export interface ItemOportunidadeApi {
  readonly escopo: EscopoMeta;
  readonly codigo: string;
  readonly percentualAtual: string;
  readonly percentualMeta: string;
  readonly desvioPontos: string;
  readonly valorParaMeta: string;
}

export interface OportunidadesApi {
  readonly classesAbaixo: readonly ItemOportunidadeApi[];
  readonly segmentosAbaixo: readonly ItemOportunidadeApi[];
  readonly watchlist: readonly unknown[];
  readonly comAlerta: readonly unknown[];
  readonly sugestaoAporte: unknown | null;
}

export interface ErroBlocoApi {
  readonly bloco: NomeBlocoDashboard;
  readonly code: string;
  readonly message: string;
}

export interface DashboardApi {
  readonly indicadores?: IndicadoresApi;
  readonly graficos?: GraficosApi;
  readonly oportunidades?: OportunidadesApi;
  readonly erros: readonly ErroBlocoApi[];
}

export const LIMITE_DIVIDENDOS = 12;
export const TOLERANCIA_DESVIO_PONTOS = "0.5";

/** Rótulos do catálogo inicial (`prisma/seed.ts`) — fallback estável. */
export const ROTULOS_REFERENCIA: Readonly<Record<string, string>> = {
  RENDA_FIXA: "Renda fixa",
  FII: "Fundos Imobiliários",
  LOGISTICA: "Logística",
  SHOPPING: "Shopping Centers",
  RECEBIVEIS: "Recebíveis Imobiliários",
  LAJES: "Lajes Corporativas",
  RENDA_URBANA: "Renda Urbana",
  HIBRIDO: "Híbridos",
  AGRO: "Agronegócio",
  OUTROS: "Outros",
  CAIXA_OPORTUNIDADES: "Caixa e Oportunidades",
};

export const ROTULOS_BLOCO: Readonly<Record<NomeBlocoDashboard, string>> = {
  indicadores: "Indicadores",
  graficos: "Gráficos",
  oportunidades: "Oportunidades",
};

export const ROTULOS_SITUACAO: Readonly<Record<SituacaoDesvio, string>> = {
  ABAIXO: "Abaixo da meta",
  ACIMA: "Acima da meta",
  DENTRO: "Dentro da meta",
};

export function rotuloReferencia(
  codigo: string,
  nomes: Readonly<Record<string, string>> = ROTULOS_REFERENCIA,
): string {
  return nomes[codigo] ?? codigo;
}

// ---------------------------------------------------------------------------
// Formatação (string decimal do contrato — nunca `number`)
// ---------------------------------------------------------------------------

/** Dinheiro em BRL (`"152340.00"` → `"R$ 152.340,00"`). */
export function formatarMoeda(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const [inteiro, centavos] = parsed.value.abs().toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${parsed.value.isNegative() ? "-" : ""}R$ ${agrupado},${centavos}`;
}

/** Percentual com casas fixas e vírgula decimal (`"40.041000"` → `"40,0%"`). */
export function formatarPercentual(valor: string, casas = 1): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  return `${parsed.value.toFixed(casas).replace(".", ",")}%`;
}

/** Desvio com sinal explícito e unidade (`"-9.959000"` → `"−10,0 p.p."`). */
export function formatarDesvioPontos(valor: string, casas = 1): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const absoluto = parsed.value.abs().toFixed(casas).replace(".", ",");
  if (parsed.value.isZero()) {
    return `${absoluto} p.p.`;
  }
  return `${parsed.value.isNegative() ? "−" : "+"}${absoluto} p.p.`;
}

/** Data ISO (`YYYY-MM-DD`) em `DD/MM/AAAA`, sem passar por fuso. */
export function formatarData(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (partes === null) {
    return "Data inválida";
  }
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** `YYYY-MM` → `"jan/26"` (rótulo compacto de eixo); fallback para o valor cru. */
export function rotuloMes(mes: string): string {
  const partes = /^(\d{4})-(\d{2})$/.exec(mes);
  if (partes === null) {
    return mes;
  }
  const indice = Number(partes[2]) - 1;
  const nome = MESES_CURTOS[indice];
  return nome === undefined ? mes : `${nome}/${partes[1].slice(2)}`;
}

/** `YYYY-MM` → `"01/2026"` para a tabela equivalente. */
export function formatarMes(mes: string): string {
  const partes = /^(\d{4})-(\d{2})$/.exec(mes);
  return partes === null ? mes : `${partes[2]}/${partes[1]}`;
}

// ---------------------------------------------------------------------------
// Comparação com a meta (50/50 é o padrão da UI_SPEC §4)
// ---------------------------------------------------------------------------

export interface LinhaMeta {
  readonly codigo: string;
  readonly rotulo: string;
  readonly atual: string;
  /** Percentual da meta com 6 casas. */
  readonly meta: string;
  /** Atual − meta, em pontos percentuais, com 6 casas. */
  readonly desvio: string;
  readonly situacao: SituacaoDesvio;
}

/** Mesma tolerância de `src/modules/alocacao/metas.ts`. */
export function classificarDesvio(desvio: Decimal): SituacaoDesvio {
  if (desvio.abs().lte(TOLERANCIA_DESVIO_PONTOS)) {
    return "DENTRO";
  }
  return desvio.isNegative() ? "ABAIXO" : "ACIMA";
}

/**
 * Linhas da barra de alocação. Usa os desvios do servidor e, sem metas
 * configuradas, compara com o padrão 50/50 (RF × FII) exigido pela UI_SPEC §4.
 */
export function linhasMeta(indicadores: IndicadoresApi): readonly LinhaMeta[] {
  if (indicadores.meta.length > 0) {
    return indicadores.meta.map((meta) => ({
      codigo: meta.codigo,
      rotulo: rotuloReferencia(meta.codigo),
      atual: meta.atual,
      meta: meta.meta,
      desvio: meta.desvio,
      situacao: meta.situacao,
    }));
  }

  return [
    { codigo: "RENDA_FIXA", atual: indicadores.percentualRendaFixa },
    { codigo: "FII", atual: indicadores.percentualFiis },
  ].map(({ codigo, atual }) => {
    const desvio = Decimal.from(atual).sub("50").toFixed(6);
    return {
      codigo,
      rotulo: rotuloReferencia(codigo),
      atual,
      meta: "50.000000",
      desvio,
      situacao: classificarDesvio(Decimal.from(desvio)),
    };
  });
}

/** Texto acessível da linha: `"Renda fixa 40,0% · meta 50,0% · −10,0 p.p."`. */
export function descreverMeta(linha: LinhaMeta): string {
  return `${linha.rotulo} ${formatarPercentual(linha.atual)} · meta ${formatarPercentual(
    linha.meta,
  )} · ${formatarDesvioPontos(linha.desvio)}`;
}

/** Posição da marca da meta na barra (0–100), como percentual visual. */
export function posicaoDaMarca(meta: string): number {
  const parsed = Decimal.parse(meta);
  if (!parsed.ok) {
    return 0;
  }
  return Math.min(100, Math.max(0, Number(parsed.value.toFixed(2))));
}

/** Largura visual da barra (0–100) a partir do percentual do contrato. */
export function larguraDaBarra(percentual: string): number {
  const parsed = Decimal.parse(percentual);
  if (!parsed.ok) {
    return 0;
  }
  return Math.min(100, Math.max(0, Number(parsed.value.toFixed(2))));
}

// ---------------------------------------------------------------------------
// Séries dos gráficos
// ---------------------------------------------------------------------------

export function somarPercentuais(itens: readonly ItemDistribuicaoApi[]): number {
  return itens.reduce((total, item) => {
    const parsed = Decimal.parse(item.percentual);
    return total + (parsed.ok ? Number(parsed.value.toFixed(4)) : 0);
  }, 0);
}

export function distribuicaoVazia(itens: readonly ItemDistribuicaoApi[]): boolean {
  return itens.length === 0 || somarPercentuais(itens) <= 0;
}

function valorZerado(valor: string): boolean {
  const parsed = Decimal.parse(valor);
  return !parsed.ok || parsed.value.isZero();
}

export function evolucaoPatrimonialVazia(
  pontos: readonly PontoEvolucaoPatrimonialApi[],
): boolean {
  return pontos.length === 0 || pontos.every((ponto) => valorZerado(ponto.patrimonio));
}

export function evolucaoRendimentosVazia(
  pontos: readonly PontoEvolucaoRendimentosApi[],
): boolean {
  return pontos.length === 0 || pontos.every((ponto) => valorZerado(ponto.valor));
}

/** Últimos 12 proventos, por data decrescente (desempate por ticker). */
export function dividendosVisiveis(
  dividendos: readonly DividendoApi[],
  limite = LIMITE_DIVIDENDOS,
): readonly DividendoApi[] {
  return [...dividendos]
    .sort((a, b) => b.data.localeCompare(a.data) || a.ativo.localeCompare(b.ativo))
    .slice(0, Math.max(0, limite));
}

/** Valor monetário de um ponto da série, para geometria (nunca para exibição). */
export function valorNumerico(valor: string): number {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return 0;
  }
  return Math.max(0, Number(parsed.value.toFixed(2)));
}

export function maiorValor(valores: readonly string[]): number {
  return valores.reduce((maior, valor) => Math.max(maior, valorNumerico(valor)), 0);
}

// ---------------------------------------------------------------------------
// Erros por bloco
// ---------------------------------------------------------------------------

export function erroDoBloco(
  erros: readonly ErroBlocoApi[],
  bloco: NomeBlocoDashboard,
): ErroBlocoApi | null {
  return erros.find((erro) => erro.bloco === bloco) ?? null;
}

export function substituirErroDoBloco(
  erros: readonly ErroBlocoApi[],
  bloco: NomeBlocoDashboard,
  novo: ErroBlocoApi | null,
): readonly ErroBlocoApi[] {
  const semBloco = erros.filter((erro) => erro.bloco !== bloco);
  return novo === null ? semBloco : [...semBloco, novo];
}
