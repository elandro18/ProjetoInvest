import { Decimal } from "../../lib/decimal";
import { dataIsoValida } from "../../lib/datas";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { aplicarMovimentacao, posicaoVazia } from "../posicao/aplicar-movimentacao";
import { custoMedio } from "../posicao/baixa";
import type { MovimentacaoParaPosicao, Posicao } from "../posicao/tipos";
import type { MovimentacaoCarteira } from "./repositorio";

/**
 * Evolução patrimonial da carteira (RN-020, RN-062; API_CONTRACTS.md §5.2).
 *
 * Reconstrução sem tabela de snapshot: a série de FIIs é o custo das posições
 * recalculado a partir do razão de movimentações não canceladas até cada
 * ponto (RN-015, RN-091). A renda fixa usa o saldo atual como constante em
 * todos os pontos porque `investimento_renda_fixa` só guarda o saldo corrente
 * — não existe histórico de saldo na Fase 1 (limitação documentada; DATA_MODEL
 * §4.8). Sem cotação, FII também é custo, nunca preço de mercado.
 */

export const GRANULARIDADES_EVOLUCAO = ["dia", "mes"] as const;

export type GranularidadeEvolucao = (typeof GRANULARIDADES_EVOLUCAO)[number];

export const GRANULARIDADE_EVOLUCAO_PADRAO: GranularidadeEvolucao = "mes";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface PontoEvolucaoCarteira {
  /** `YYYY-MM-DD`. */
  readonly data: string;
  readonly patrimonio: string;
  readonly rendaFixa: string;
  readonly fiis: string;
}

export interface EvolucaoCarteira {
  readonly pontos: readonly PontoEvolucaoCarteira[];
}

export interface DadosEvolucaoCarteira {
  readonly de: string;
  readonly ate: string;
  readonly granularidade: GranularidadeEvolucao;
  readonly movimentacoes: readonly MovimentacaoCarteira[];
  /** Saldo atual da renda fixa, constante na série (limitação da Fase 1). */
  readonly saldoRendaFixa: string;
}

interface DataCivil {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

function parseData(valor: string): DataCivil | null {
  if (!dataIsoValida(valor)) {
    return null;
  }

  const [ano, mes, dia] = valor.split("-").map(Number);
  return { ano, mes, dia };
}

function formatar(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function granularidadeEvolucaoValida(
  valor: string,
): valor is GranularidadeEvolucao {
  return (GRANULARIDADES_EVOLUCAO as readonly string[]).includes(valor);
}

/** Primeiro dia do ano da data de referência (`YYYY-01-01`). */
export function inicioDoAno(dataReferencia: string): string {
  return `${dataReferencia.slice(0, 4)}-01-01`;
}

/**
 * Valida o período e a granularidade. Erros viram `VALIDACAO` (422) com o
 * campo inválido, como exige a API_CONTRACTS.md §5.2.
 */
export function validarPeriodoEvolucao(
  de: string,
  ate: string,
  granularidade: string = GRANULARIDADE_EVOLUCAO_PADRAO,
): Result<void, AppError> {
  if (!granularidadeEvolucaoValida(granularidade)) {
    return err(
      errors.validacao([
        {
          field: "granularidade",
          message: "Granularidade inválida. Use dia ou mes.",
        },
      ]),
    );
  }

  if (!dataIsoValida(de)) {
    return err(
      errors.validacao([
        { field: "de", message: "Data inicial inválida (use YYYY-MM-DD)." },
      ]),
    );
  }

  if (!dataIsoValida(ate)) {
    return err(
      errors.validacao([
        { field: "ate", message: "Data final inválida (use YYYY-MM-DD)." },
      ]),
    );
  }

  if (de > ate) {
    return err(
      errors.validacao([
        {
          field: "de",
          message: "A data inicial não pode ser posterior à data final.",
        },
      ]),
    );
  }

  return ok(undefined);
}

/**
 * Datas dos pontos da série, em ordem crescente e dentro de `[de, ate]`.
 *
 * - `mes`: último dia de cada mês; o mês corrente (ou o mês de `ate`) é
 *   limitado a `ate`. Uma série de 12 meses gera no máximo 12 pontos.
 * - `dia`: um ponto por dia, inclusive as pontas.
 */
export function pontosDoPeriodo(
  de: string,
  ate: string,
  granularidade: GranularidadeEvolucao,
): readonly string[] {
  const inicio = parseData(de);
  const fim = parseData(ate);

  if (inicio === null || fim === null) {
    throw new Error("Período inválido na geração dos pontos de evolução.");
  }

  if (granularidade === "dia") {
    const pontos: string[] = [];
    const inicioMs = Date.UTC(inicio.ano, inicio.mes - 1, inicio.dia);
    const fimMs = Date.UTC(fim.ano, fim.mes - 1, fim.dia);

    for (let ms = inicioMs; ms <= fimMs; ms += MS_POR_DIA) {
      pontos.push(new Date(ms).toISOString().slice(0, 10));
    }

    return pontos;
  }

  const pontos: string[] = [];
  let ano = inicio.ano;
  let mes = inicio.mes;

  while (ano < fim.ano || (ano === fim.ano && mes <= fim.mes)) {
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dia = ano === fim.ano && mes === fim.mes ? Math.min(ultimoDia, fim.dia) : ultimoDia;
    const ponto = formatar(ano, mes, dia);

    if (ponto >= de) {
      pontos.push(ponto);
    }

    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }

  return pontos;
}

function compararMovimentacoes(a: MovimentacaoParaPosicao, b: MovimentacaoParaPosicao): number {
  if (a.data !== b.data) {
    return a.data < b.data ? -1 : 1;
  }

  return a.criadoEm.getTime() - b.criadoEm.getTime();
}

/**
 * Aplica todas as movimentações até `data` sobre o estado das posições e
 * devolve o novo cursor do razão. Os pontos são gerados em ordem crescente, por
 * isso cada movimentação é aplicada uma única vez (O(movimentações + pontos)).
 */
function aplicarMovimentacoesAte(
  movimentacoes: readonly MovimentacaoCarteira[],
  indiceInicial: number,
  data: string,
  posicoes: Map<string, Posicao>,
): number {
  let indice = indiceInicial;

  while (indice < movimentacoes.length && movimentacoes[indice].data <= data) {
    const movimentacao = movimentacoes[indice];
    const posicaoAtual = posicoes.get(movimentacao.ativoId) ?? posicaoVazia();

    // `permitirPosicaoNegativa` reflete a exceção já confirmada e auditada na
    // criação da movimentação (RN-018): a série não pode quebrar por causa de
    // uma venda que o titular confirmou.
    const aplicada = aplicarMovimentacao(posicaoAtual, movimentacao, custoMedio, {
      permitirPosicaoNegativa: true,
    });

    if (!aplicada.ok) {
      throw errors.erroInterno({ movimentacaoId: movimentacao.id });
    }

    posicoes.set(movimentacao.ativoId, aplicada.value);
    indice += 1;
  }

  return indice;
}

function somarCustos(posicoes: Iterable<Posicao>): Decimal {
  let total = Decimal.zero(2);
  for (const posicao of posicoes) {
    total = total.add(posicao.custoTotal);
  }
  return total;
}

export function montarEvolucaoCarteira(
  dados: DadosEvolucaoCarteira,
): EvolucaoCarteira {
  const saldoRendaFixa = Decimal.from(dados.saldoRendaFixa);
  const pontosData = pontosDoPeriodo(dados.de, dados.ate, dados.granularidade);

  const movimentacoes = dados.movimentacoes
    .filter((movimentacao) => movimentacao.canceladaEm === null)
    .sort(compararMovimentacoes);

  const posicoes = new Map<string, Posicao>();
  let indice = 0;

  const pontos = pontosData.map((data): PontoEvolucaoCarteira => {
    indice = aplicarMovimentacoesAte(movimentacoes, indice, data, posicoes);
    const fiis = somarCustos(posicoes.values());

    return {
      data,
      patrimonio: saldoRendaFixa.add(fiis).toFixed(2),
      rendaFixa: saldoRendaFixa.toFixed(2),
      fiis: fiis.toFixed(2),
    };
  });

  return { pontos };
}
