import { Decimal } from "@/src/lib/decimal";
import type { CarteiraApi, PosicaoApi } from "@/src/modules/carteira/apresentacao";
import {
  OPCOES_STATUS,
  TONS_STATUS,
  rotuloStatus,
  type StatusAtivo,
} from "../ativos/ativos-ui";

/**
 * Tipos e regras de forma da tela de carteira (RN-020-3; UI_SPEC §5).
 *
 * Fora de `src/modules/**` de propósito: aqui vivem rótulo, formatação e
 * filtro de apresentação — a consolidação e a consistência continuam no
 * servidor. Nenhum valor passa por `number`: dinheiro, quantidade e
 * percentual são formatados a partir da string decimal do contrato (ADR-006).
 *
 * O mapa de status vem de `GET /api/ativos` porque a resposta da carteira não
 * carrega a situação do ativo (RN-020-5).
 */

export type { CarteiraApi, PosicaoApi, StatusAtivo };
export { OPCOES_STATUS, TONS_STATUS, rotuloStatus };

export interface AtivoStatusApi {
  readonly id: string;
  readonly status: StatusAtivo;
}

export interface MetaListaApi {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaAtivosStatusApi {
  readonly data: readonly AtivoStatusApi[];
  readonly meta: MetaListaApi;
}

export type MapaStatusAtivo = Readonly<Record<string, StatusAtivo>>;

/** Teto de página aceito por `GET /api/ativos` (API_CONTRACTS.md §3.1). */
export const PAGE_SIZE_STATUS = 100;

/**
 * Converte a lista paginada de ativos no mapa `ativoId → status`.
 *
 * Limitação conhecida: o contrato de listagem aceita no máximo 100 ativos por
 * página. A tela pede `pageSize=100`; acima disso os ativos excedentes ficam
 * sem situação na tabela e fora do filtro por status.
 */
export function mapaDeStatus(lista: ListaAtivosStatusApi): MapaStatusAtivo {
  const mapa: Record<string, StatusAtivo> = {};
  for (const ativo of lista.data) {
    mapa[ativo.id] = ativo.status;
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Filtros (cliente sobre `posicoes`)
// ---------------------------------------------------------------------------

export type FiltroStatus = StatusAtivo | "";

export interface FiltrosPosicao {
  readonly classe: string;
  readonly segmento: string;
  readonly status: FiltroStatus;
}

export const FILTROS_VAZIOS: FiltrosPosicao = { classe: "", segmento: "", status: "" };

export interface OpcaoFiltro {
  readonly valor: string;
  readonly rotulo: string;
}

export function temFiltroAtivo(filtros: FiltrosPosicao): boolean {
  return filtros.classe !== "" || filtros.segmento !== "" || filtros.status !== "";
}

function opcoesUnicas(
  entradas: Iterable<{ readonly codigo: string; readonly nome: string }>,
): readonly OpcaoFiltro[] {
  const porCodigo = new Map<string, string>();
  for (const entrada of entradas) {
    if (!porCodigo.has(entrada.codigo)) {
      porCodigo.set(entrada.codigo, entrada.nome);
    }
  }

  return [...porCodigo.entries()]
    .map(([valor, rotulo]) => ({ valor, rotulo }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Classes presentes nas posições, ordenadas pelo nome apresentado. */
export function classesDaCarteira(posicoes: readonly PosicaoApi[]): readonly OpcaoFiltro[] {
  return opcoesUnicas(posicoes.map((posicao) => posicao.classe));
}

/** Segmentos presentes nas posições — restritos à classe selecionada, quando houver. */
export function segmentosDaCarteira(
  posicoes: readonly PosicaoApi[],
  classe: string,
): readonly OpcaoFiltro[] {
  const daClasse =
    classe === ""
      ? posicoes
      : posicoes.filter((posicao) => posicao.classe.codigo === classe);

  return opcoesUnicas(
    daClasse
      .map((posicao) => posicao.segmento)
      .filter((segmento): segmento is NonNullable<PosicaoApi["segmento"]> => segmento !== null),
  );
}

/**
 * Aplica os filtros no cliente. Status desconhecido (fora das 100 primeiras
 * posições da listagem de ativos) nunca casa com um status específico.
 */
export function filtrarPosicoes(
  posicoes: readonly PosicaoApi[],
  statusPorAtivo: MapaStatusAtivo,
  filtros: FiltrosPosicao,
): readonly PosicaoApi[] {
  return posicoes.filter((posicao) => {
    if (filtros.classe !== "" && posicao.classe.codigo !== filtros.classe) {
      return false;
    }
    if (filtros.segmento !== "" && posicao.segmento?.codigo !== filtros.segmento) {
      return false;
    }
    if (filtros.status !== "" && statusPorAtivo[posicao.ativoId] !== filtros.status) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Ordenação
// ---------------------------------------------------------------------------

export type ColunaOrdenavel = "ticker" | "quantidade" | "valorAtual" | "percentual";

export type DirecaoOrdem = "asc" | "desc";

export interface OrdenacaoPosicao {
  readonly coluna: ColunaOrdenavel;
  readonly direcao: DirecaoOrdem;
}

/** Espelha a ordem do contrato: `valorAtual` desc (RN-020-5). */
export const ORDENACAO_PADRAO: OrdenacaoPosicao = { coluna: "valorAtual", direcao: "desc" };

function compararDecimais(a: string, b: string): number {
  const primeiro = Decimal.parse(a);
  const segundo = Decimal.parse(b);
  if (!primeiro.ok && !segundo.ok) {
    return 0;
  }
  if (!primeiro.ok) {
    return -1;
  }
  if (!segundo.ok) {
    return 1;
  }
  return primeiro.value.compare(segundo.value);
}

function compararPor(coluna: ColunaOrdenavel, a: PosicaoApi, b: PosicaoApi): number {
  switch (coluna) {
    case "ticker":
      return a.ticker.localeCompare(b.ticker, "pt-BR");
    case "quantidade":
      return compararDecimais(a.quantidade, b.quantidade);
    case "valorAtual":
      return compararDecimais(a.valorAtual, b.valorAtual);
    case "percentual":
      return compararDecimais(a.percentual, b.percentual);
  }
}

export function ordenarPosicoes(
  posicoes: readonly PosicaoApi[],
  ordenacao: OrdenacaoPosicao,
): readonly PosicaoApi[] {
  const fator = ordenacao.direcao === "asc" ? 1 : -1;

  return [...posicoes].sort((a, b) => {
    const comparacao = compararPor(ordenacao.coluna, a, b);
    if (comparacao !== 0) {
      return comparacao * fator;
    }
    return a.ticker.localeCompare(b.ticker, "pt-BR");
  });
}

/** Primeiro clique ordena asc; clicar de novo na mesma coluna inverte. */
export function proximaOrdenacao(
  atual: OrdenacaoPosicao,
  coluna: ColunaOrdenavel,
): OrdenacaoPosicao {
  if (atual.coluna !== coluna) {
    return { coluna, direcao: "asc" };
  }
  return { coluna, direcao: atual.direcao === "asc" ? "desc" : "asc" };
}

export function ariaSortDe(
  atual: OrdenacaoPosicao,
  coluna: ColunaOrdenavel,
): "ascending" | "descending" | "none" {
  if (atual.coluna !== coluna) {
    return "none";
  }
  return atual.direcao === "asc" ? "ascending" : "descending";
}

// ---------------------------------------------------------------------------
// Formatação (string decimal do contrato — nunca `number`)
// ---------------------------------------------------------------------------

export const MOTIVO_COTACAO_INDISPONIVEL =
  "Cotação de mercado ainda não coletada. O valor atual usa o custo de aquisição (RN-091).";

export const MOTIVO_RESULTADO_INDISPONIVEL =
  "O resultado exige cotação de mercado e não é calculado na Fase 1 (RN-091).";

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

/** Percentual com casas fixas, vírgula decimal (`"40.041000"` → `"40,0%"`). */
export function formatarPercentual(valor: string, casas = 1): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  return `${parsed.value.toFixed(casas).replace(".", ",")}%`;
}

/** Quantidade sem zeros à direita (`"100.00000000"` → `"100"`, `"1.5"` → `"1,5"`). */
export function formatarQuantidade(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const fixo = parsed.value
    .abs()
    .toFixed(8)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  const [inteiro, decimais] = fixo.split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sinal = parsed.value.isNegative() ? "-" : "";

  return decimais === undefined ? `${sinal}${agrupado}` : `${sinal}${agrupado},${decimais}`;
}

/** Data/hora da última consolidação (`atualizadoEm`). */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return "Não informado";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

/** Sem patrimônio: total zerado e nenhuma posição (API_CONTRACTS §5.1). */
export function ehPatrimonioVazio(carteira: CarteiraApi): boolean {
  const total = Decimal.parse(carteira.resumo.patrimonioTotal);
  return carteira.posicoes.length === 0 && (!total.ok || total.value.isZero());
}

export function possuiValorIndisponivel(carteira: CarteiraApi): boolean {
  return (
    carteira.posicoes.some((posicao) => posicao.valorIndisponivel) ||
    carteira.porClasse.some((item) => item.valorIndisponivel) ||
    carteira.porSegmento.some((item) => item.valorIndisponivel)
  );
}
