import type { StatusBadgeTone } from "@/src/components/ui/status-badge";
import { Decimal } from "@/src/lib/decimal";
import type { SugestaoHistoricoItemApi } from "@/src/modules/aportes/apresentacao";
import type {
  DecisaoUsuario,
  LinhaDistribuicaoAtual,
  LinhaDistribuicaoSugerida,
  ResumoDistribuicaoSugerida,
} from "@/src/modules/aportes/tipos";

import { ROTULOS_DECISAO, TONS_DECISAO, rotuloReferencia } from "../aportes-ui";

/**
 * Tipos e regras de forma do histórico de sugestões (RN-052-2; UI_SPEC §10.1).
 *
 * Fica fora de `src/modules/**` de propósito: aqui vivem rótulo, formatação e
 * montagem de query — nenhum cálculo de sugestão. O snapshot exibido é
 * exatamente o persistido (RN-052); a tela só apresenta.
 *
 * Somente leitura: nada nesta camada decide ou reescreve a decisão registrada
 * (RN-053 é a tela de `/aportes`).
 */

/** Mesmo padrão das demais listas (API_CONTRACTS.md §8.3). */
export const PAGE_SIZE_HISTORICO = 20;

export interface MetaHistoricoApi {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaHistoricoApi {
  readonly data: readonly SugestaoHistoricoItemApi[];
  readonly meta: MetaHistoricoApi;
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export interface FiltrosHistorico {
  /** `YYYY-MM-DD`, inclusivo. */
  readonly de: string;
  /** `YYYY-MM-DD`, inclusivo. */
  readonly ate: string;
  readonly decisao: DecisaoUsuario | "";
}

export const FILTROS_VAZIOS: FiltrosHistorico = { de: "", ate: "", decisao: "" };

export const OPCOES_DECISAO_FILTRO: readonly {
  readonly valor: DecisaoUsuario | "";
  readonly rotulo: string;
}[] = [
  { valor: "", rotulo: "Todas as decisões" },
  { valor: "ACEITA", rotulo: ROTULOS_DECISAO.ACEITA },
  { valor: "IGNORADA", rotulo: ROTULOS_DECISAO.IGNORADA },
  { valor: "ALTERADA", rotulo: ROTULOS_DECISAO.ALTERADA },
];

export function temFiltroHistorico(filtros: FiltrosHistorico): boolean {
  return filtros.de !== "" || filtros.ate !== "" || filtros.decisao !== "";
}

/**
 * Path da listagem com a query do contrato (§8.3).
 *
 * Filtro vazio não entra na query — a API aplica o default dela (todas as
 * decisões), e a URL fica legível. A ordem não vai na query: é fixa em
 * `data` desc por regra do servidor.
 */
export function consultaHistorico(filtros: FiltrosHistorico, page: number): string {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, Math.trunc(page))));
  params.set("pageSize", String(PAGE_SIZE_HISTORICO));
  if (filtros.de !== "") {
    params.set("de", filtros.de);
  }
  if (filtros.ate !== "") {
    params.set("ate", filtros.ate);
  }
  if (filtros.decisao !== "") {
    params.set("decisao", filtros.decisao);
  }
  return `/api/aportes/historico?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------

interface RotuloDecisao {
  readonly texto: string;
  readonly tone: StatusBadgeTone;
}

/**
 * Decisão registrada ou "Sem decisão" (RN-052).
 *
 * A ausência é informação: a sugestão existe no histórico mesmo sem decisão, e
 * a lista não pode omiti-la nem exibir um estado positivo por engano.
 */
export function rotuloDecisaoHistorico(decisao: DecisaoUsuario | null): RotuloDecisao {
  if (decisao === null) {
    return { texto: "Sem decisão", tone: "neutral" };
  }

  return { texto: ROTULOS_DECISAO[decisao], tone: TONS_DECISAO[decisao] };
}

/** Detecta o 404 unificado do detalhe (§8.4) — id inexistente ou de outro titular. */
export function ehSugestaoNaoEncontrada(status: number, codigo: string): boolean {
  return status === 404 || codigo === "APORTE_NAO_ENCONTRADO";
}

// ---------------------------------------------------------------------------
// Resumo por classe (lista)
// ---------------------------------------------------------------------------

export interface LinhaResumoExibicao {
  readonly codigo: string;
  readonly rotulo: string;
  readonly valor: string;
}

/** Resumo da lista com o rótulo da classe já resolvido. */
export function resumoPorClasse(
  resumo: ResumoDistribuicaoSugerida,
): readonly LinhaResumoExibicao[] {
  return resumo.classe.map((linha) => ({
    codigo: linha.codigo,
    rotulo: rotuloReferencia(linha.codigo),
    valor: linha.valor,
  }));
}

// ---------------------------------------------------------------------------
// Distribuição do detalhe (atual × sugerida)
// ---------------------------------------------------------------------------

/** Percentual com sinal de unidade; inválido nunca vira "0%" (ausência é informação). */
export function formatarPercentual(valor: string, casas = 2): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  return `${parsed.value.toFixed(casas).replace(".", ",")}%`;
}

export interface LinhaDistribuicaoExibicao {
  readonly codigo: string;
  readonly rotulo: string;
  /** `null` quando a classe/segmento não existia na carteira no momento. */
  readonly percentualAtual: string | null;
  /** `null` quando a distribuição sugerida não tinha esta linha. */
  readonly valorSugerido: string | null;
  readonly justificativa: string | null;
}

function positivoOuZero(valor: string): boolean {
  const parsed = Decimal.parse(valor);
  return parsed.ok && parsed.value.gt("0");
}

/**
 * Junta a fotografia da carteira (`distribuicaoAtual`) com a sugestão gravada
 * (`distribuicaoSugerida`) na ordem da sugestão.
 *
 * `incluirZerados = false` é usado no recorte por segmento: linha sem exposição
 * atual e sem aporte não é listada (UI_SPEC §10) — o histórico continua
 * completo no snapshot, só não polui a leitura.
 */
export function mesclarDistribuicao(
  atual: readonly LinhaDistribuicaoAtual[],
  sugerida: readonly LinhaDistribuicaoSugerida[],
  incluirZerados = true,
): readonly LinhaDistribuicaoExibicao[] {
  const atuais = new Map(atual.map((linha) => [linha.codigo, linha.percentual]));
  const codigos: string[] = [];

  for (const linha of sugerida) {
    if (!codigos.includes(linha.codigo)) {
      codigos.push(linha.codigo);
    }
  }
  for (const linha of atual) {
    if (!codigos.includes(linha.codigo)) {
      codigos.push(linha.codigo);
    }
  }

  const linhas: LinhaDistribuicaoExibicao[] = codigos.map((codigo) => {
    const sugeridaLinha = sugerida.find((linha) => linha.codigo === codigo) ?? null;
    return {
      codigo,
      rotulo: rotuloReferencia(codigo),
      percentualAtual: atuais.get(codigo) ?? null,
      valorSugerido: sugeridaLinha === null ? null : sugeridaLinha.valor,
      justificativa: sugeridaLinha === null ? null : sugeridaLinha.justificativa,
    };
  });

  if (incluirZerados) {
    return linhas;
  }

  return linhas.filter((linha) => {
    const temExposicao =
      linha.percentualAtual !== null && positivoOuZero(linha.percentualAtual);
    const temAporte = linha.valorSugerido !== null && positivoOuZero(linha.valorSugerido);
    return temExposicao || temAporte;
  });
}
