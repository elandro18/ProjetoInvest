/**
 * Tipos compartilhados da sugestão de aporte (RN-025, RN-050 a RN-053;
 * DATA_MODEL.md §4.15).
 *
 * O snapshot persistido usa exatamente as formas abaixo — a apresentação da
 * API apenas serializa o registro, sem recalcular nada. Valores e percentuais
 * são strings decimais com a escala do contrato (`"1000.00"`, `"40.041000"`).
 */

import { Decimal } from "../../lib/decimal";

export const DECISOES_USUARIO = ["ACEITA", "IGNORADA", "ALTERADA"] as const;

export type DecisaoUsuario = (typeof DECISOES_USUARIO)[number];

export function ehDecisaoUsuario(valor: string): valor is DecisaoUsuario {
  return (DECISOES_USUARIO as readonly string[]).includes(valor);
}

/** Item de checklist com três estados; ausência de dado nunca vira "SIM" (RN-077). */
export type ItemTresEstados = "SIM" | "NAO" | "INDISPONIVEL";

export const CLASSIFICACOES_APORTE = [
  "ABAIXO_META_APTO_PARA_ESTUDO",
  "ABAIXO_META_COM_RISCOS",
  "DENTRO_META",
  "ACIMA_META",
  "SEM_DADOS_SUFICIENTES",
] as const;

export type ClassificacaoAporte = (typeof CLASSIFICACOES_APORTE)[number];

/** Checklist de oito verificações por ativo candidato (RN-050). */
export interface ChecklistAporte {
  readonly classeAbaixoMeta: boolean;
  readonly segmentoAbaixoMeta: boolean;
  readonly ativoJaNaCarteira: boolean;
  readonly aumentaConcentracao: ItemTresEstados;
  readonly dadosSuficientes: ItemTresEstados;
  readonly atendeQualidade: ItemTresEstados;
  readonly alertaRelevante: boolean;
  readonly precoDentroParametros: ItemTresEstados;
}

export interface AtivoAvaliado {
  readonly ativoId: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: string;
  readonly segmento: string | null;
  readonly classificacao: ClassificacaoAporte;
  readonly checklist: ChecklistAporte;
  readonly motivos: readonly string[];
}

export interface LinhaDistribuicaoAtual {
  readonly codigo: string;
  /** Participação no patrimônio atual com 6 casas. */
  readonly percentual: string;
}

export interface DistribuicaoAtual {
  readonly classe: readonly LinhaDistribuicaoAtual[];
  readonly segmento: readonly LinhaDistribuicaoAtual[];
}

export interface LinhaDistribuicaoSugerida {
  readonly codigo: string;
  /** Valor com 2 casas. */
  readonly valor: string;
  readonly justificativa: string;
}

export interface DistribuicaoSugerida {
  readonly classe: readonly LinhaDistribuicaoSugerida[];
  readonly segmento: readonly LinhaDistribuicaoSugerida[];
}

/** Linha da classe no resumo da lista do histórico (RN-052). */
export interface LinhaResumoDistribuicao {
  readonly codigo: string;
  /** Valor com 2 casas. */
  readonly valor: string;
}

export interface ResumoDistribuicaoSugerida {
  readonly classe: readonly LinhaResumoDistribuicao[];
}

/**
 * Recorte da distribuição sugerida exibido na lista do histórico (RN-052,
 * decisão 5 da análise técnica): apenas as classes que receberam valor, sem
 * justificativa e sem o recorte por segmento. O snapshot completo fica no
 * detalhe — a lista não pode crescer com o tamanho de `ativos_avaliados`.
 */
export function resumirDistribuicaoSugerida(
  distribuicao: DistribuicaoSugerida,
): ResumoDistribuicaoSugerida {
  return {
    classe: distribuicao.classe
      .filter((linha) => Decimal.from(linha.valor).gt("0"))
      .map((linha) => ({ codigo: linha.codigo, valor: linha.valor })),
  };
}

/** Snapshot completo da sugestão (RN-052). */
export interface SugestaoAporteRegistro {
  readonly id: string;
  readonly usuarioId: string;
  readonly data: Date;
  readonly valorDisponivel: string;
  readonly distribuicaoAtual: DistribuicaoAtual;
  readonly distribuicaoSugerida: DistribuicaoSugerida;
  readonly ativosAvaliados: readonly AtivoAvaliado[];
  readonly justificativas: readonly string[];
  readonly alertas: readonly string[];
  readonly decisaoUsuario: DecisaoUsuario | null;
  readonly decisaoEm: Date | null;
  /** Observação livre registrada com a decisão (RN-053). */
  readonly observacoesDecisao: string | null;
}

/** Linha a inserir em `sugestao_aporte`. */
export interface NovaSugestaoAporte {
  readonly usuarioId: string;
  readonly data: Date;
  readonly valorDisponivel: string;
  readonly distribuicaoAtual: DistribuicaoAtual;
  readonly distribuicaoSugerida: DistribuicaoSugerida;
  readonly ativosAvaliados: readonly AtivoAvaliado[];
  readonly justificativas: readonly string[];
  readonly alertas: readonly string[];
}
