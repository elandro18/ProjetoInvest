import { Decimal } from "../../lib/decimal";
import { BASE_CALCULO_PATRIMONIO_TOTAL } from "../carteira/valor-carteira";
import { normalizarReferencia } from "./limites";
import type {
  DimensaoConcentracao,
  LimiteRegistro,
  PosicaoConcentracao,
  TituloConcentracao,
} from "./repositorio";

/**
 * Cálculo da concentração da carteira por dimensão (RN-049-3; RN-089, RN-091;
 * API_CONTRACTS.md §12.1).
 *
 * A base é o patrimônio total (RN-089), já calculado pelo port `ValorCarteira`
 * — este módulo não recalcula patrimônio. Sem cotação, FII entra pelo custo e
 * renda fixa pelo saldo (RN-091).
 *
 * Regras por dimensão:
 * - `ATIVO`: cada posição de FII, referência = ticker;
 * - `GESTORA`: soma por `ativo.gestor`; ativo sem gestor é ignorado;
 * - `SEGMENTO`: soma por segmento do ativo, referência = código;
 * - `EMISSOR`: soma dos títulos de renda fixa por instituição;
 * - `IMOVEL`: indisponível até a ficha do FII (Fase 3/4) — `disponivel: false`.
 *
 * Resolução do limite: o limite específico da referência (sem caixa) vence; na
 * ausência dele vale o limite da dimensão com `referencia` nula. Sem nenhum
 * dos dois, `limite` é `null` e não há alerta.
 */

export interface ItemConcentracao {
  readonly referencia: string;
  readonly nome: string;
  /** Valor com 2 casas. */
  readonly valor: string;
  /** Participação no patrimônio total com 6 casas. */
  readonly percentual: string;
  /** Limite vigente com 6 casas, ou `null` quando não configurado. */
  readonly limite: string | null;
  readonly excedido: boolean;
  /** Percentual − limite em pontos percentuais; `"0.000000"` quando não excede. */
  readonly excessoPontos: string;
}

export interface DimensaoCalculada {
  readonly dimensao: DimensaoConcentracao;
  readonly disponivel: boolean;
  readonly itens: readonly ItemConcentracao[];
}

export interface ConcentracaoCalculada {
  readonly baseCalculo: typeof BASE_CALCULO_PATRIMONIO_TOTAL;
  readonly dimensoes: readonly DimensaoCalculada[];
}

export interface DadosCalculoConcentracao {
  /** Patrimônio total com 2 casas, vindo do port `ValorCarteira`. */
  readonly total: string;
  readonly posicoes: readonly PosicaoConcentracao[];
  readonly titulos: readonly TituloConcentracao[];
  readonly limites: readonly LimiteRegistro[];
}

interface Grupo {
  /** Referência de exibição, como cadastrada. */
  readonly referencia: string;
  readonly nome: string;
  valor: Decimal;
}

interface LimitesDimensao {
  readonly especificos: Map<string, Decimal>;
  padrao: Decimal | null;
}

const ESCALA_PERCENTUAL = 6;

function adicionar(
  grupos: Map<string, Grupo>,
  referencia: string,
  nome: string,
  valor: Decimal,
): void {
  const chave = referencia.toLowerCase();
  const existente = grupos.get(chave);

  if (existente === undefined) {
    grupos.set(chave, { referencia, nome, valor });
    return;
  }

  existente.valor = existente.valor.add(valor);
}

function indexarLimites(limites: readonly LimiteRegistro[]): Map<DimensaoConcentracao, LimitesDimensao> {
  const mapa = new Map<DimensaoConcentracao, LimitesDimensao>();

  for (const limite of limites) {
    let entrada = mapa.get(limite.dimensao);
    if (entrada === undefined) {
      entrada = { especificos: new Map(), padrao: null };
      mapa.set(limite.dimensao, entrada);
    }

    const percentual = Decimal.from(limite.percentualMax);
    const referencia = normalizarReferencia(limite.referencia);

    if (referencia === null) {
      entrada.padrao = percentual;
    } else {
      entrada.especificos.set(referencia.toLowerCase(), percentual);
    }
  }

  return mapa;
}

function montarItens(
  grupos: Map<string, Grupo>,
  total: Decimal,
  limites: LimitesDimensao | undefined,
): ItemConcentracao[] {
  const ordenados = [...grupos.values()]
    .filter((grupo) => grupo.valor.gt("0"))
    .sort(
      (a, b) => b.valor.compare(a.valor) || a.referencia.localeCompare(b.referencia),
    );

  return ordenados.map((grupo) => {
    const percentual = total.isZero()
      ? Decimal.zero(ESCALA_PERCENTUAL)
      : grupo.valor.mul("100").div(total, ESCALA_PERCENTUAL);

    const limite =
      limites?.especificos.get(grupo.referencia.toLowerCase()) ?? limites?.padrao ?? null;
    const excedido = limite !== null && percentual.gt(limite);
    const excesso =
      limite !== null && excedido
        ? percentual.sub(limite)
        : Decimal.zero(ESCALA_PERCENTUAL);

    return {
      referencia: grupo.referencia,
      nome: grupo.nome,
      valor: grupo.valor.toFixed(2),
      percentual: percentual.toFixed(ESCALA_PERCENTUAL),
      limite: limite === null ? null : limite.toFixed(ESCALA_PERCENTUAL),
      excedido,
      excessoPontos: excesso.toFixed(ESCALA_PERCENTUAL),
    };
  });
}

export function calcularConcentracao(
  dados: DadosCalculoConcentracao,
): ConcentracaoCalculada {
  const total = Decimal.from(dados.total);
  const limites = indexarLimites(dados.limites);

  const ativos = new Map<string, Grupo>();
  const gestoras = new Map<string, Grupo>();
  const segmentos = new Map<string, Grupo>();

  for (const posicao of dados.posicoes) {
    const valor = Decimal.from(posicao.valor);
    adicionar(ativos, posicao.ticker.trim(), posicao.nome, valor);

    // Ativo sem gestor não gera item de gestora e não é alertado (RN-049-3).
    const gestor = normalizarReferencia(posicao.gestor);
    if (gestor !== null) {
      adicionar(gestoras, gestor, gestor, valor);
    }

    if (posicao.segmentoCodigo !== null) {
      adicionar(
        segmentos,
        posicao.segmentoCodigo.trim(),
        posicao.segmentoNome ?? posicao.segmentoCodigo,
        valor,
      );
    }
  }

  const emissores = new Map<string, Grupo>();
  for (const titulo of dados.titulos) {
    const instituicao = normalizarReferencia(titulo.instituicao);
    if (instituicao !== null) {
      adicionar(emissores, instituicao, instituicao, Decimal.from(titulo.saldo));
    }
  }

  return {
    baseCalculo: BASE_CALCULO_PATRIMONIO_TOTAL,
    dimensoes: [
      {
        dimensao: "ATIVO",
        disponivel: true,
        itens: montarItens(ativos, total, limites.get("ATIVO")),
      },
      {
        dimensao: "GESTORA",
        disponivel: true,
        itens: montarItens(gestoras, total, limites.get("GESTORA")),
      },
      {
        dimensao: "SEGMENTO",
        disponivel: true,
        itens: montarItens(segmentos, total, limites.get("SEGMENTO")),
      },
      {
        dimensao: "EMISSOR",
        disponivel: true,
        itens: montarItens(emissores, total, limites.get("EMISSOR")),
      },
      { dimensao: "IMOVEL", disponivel: false, itens: [] },
    ],
  };
}
