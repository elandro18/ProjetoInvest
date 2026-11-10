import type { ResumoSugestaoAporte } from "./repositorio";
import type {
  AtivoAvaliado,
  DecisaoUsuario,
  DistribuicaoAtual,
  DistribuicaoSugerida,
  ResumoDistribuicaoSugerida,
  SugestaoAporteRegistro,
} from "./tipos";

/**
 * Forma pública da simulação (API_CONTRACTS.md §8.2).
 *
 * O caso de uso da RN-028 já devolve o corpo do contrato; a tela importa o
 * tipo daqui para não depender do módulo que lê carteira e metas.
 */
export type {
  ComparativoSimulacao as ComparativoSimulacaoApi,
  LinhaDelta as LinhaDeltaApi,
  LinhaSimulacao as LinhaSimulacaoApi,
  SimulacaoAporte as SimulacaoAporteApi,
} from "./simular-aporte";

/**
 * Forma pública da sugestão de aporte (API_CONTRACTS.md §8.1–§8.3).
 *
 * O snapshot já é gravado no formato do contrato; a apresentação só troca as
 * datas por ISO e garante que nenhum campo interno do titular (hash, token)
 * vaze para a resposta.
 */

export interface SugestaoAporteApi {
  readonly id: string;
  readonly data: string;
  readonly valorDisponivel: string;
  readonly distribuicaoAtual: DistribuicaoAtual;
  readonly distribuicaoSugerida: DistribuicaoSugerida;
  readonly ativosAvaliados: readonly AtivoAvaliado[];
  readonly justificativas: readonly string[];
  readonly alertas: readonly string[];
}

export interface DecisaoAporteApi {
  readonly id: string;
  readonly decisaoUsuario: string | null;
  readonly decisaoEm: string | null;
  readonly observacoes: string | null;
}

/** Item da lista do histórico (API_CONTRACTS.md §8.3). */
export interface SugestaoHistoricoItemApi {
  readonly id: string;
  readonly data: string;
  readonly valorDisponivel: string;
  readonly decisaoUsuario: DecisaoUsuario | null;
  readonly decisaoEm: string | null;
  readonly resumo: ResumoDistribuicaoSugerida;
}

/** Detalhe de uma sugestão: snapshot inteiro + decisão (API_CONTRACTS.md §8.4). */
export interface SugestaoDetalheApi extends SugestaoAporteApi {
  readonly decisaoUsuario: DecisaoUsuario | null;
  readonly decisaoEm: string | null;
  readonly observacoes: string | null;
}

export function apresentarSugestao(registro: SugestaoAporteRegistro): SugestaoAporteApi {
  return {
    id: registro.id,
    data: registro.data.toISOString(),
    valorDisponivel: registro.valorDisponivel,
    distribuicaoAtual: registro.distribuicaoAtual,
    distribuicaoSugerida: registro.distribuicaoSugerida,
    ativosAvaliados: registro.ativosAvaliados,
    justificativas: registro.justificativas,
    alertas: registro.alertas,
  };
}

export function apresentarDecisao(registro: SugestaoAporteRegistro): DecisaoAporteApi {
  return {
    id: registro.id,
    decisaoUsuario: registro.decisaoUsuario,
    decisaoEm: registro.decisaoEm === null ? null : registro.decisaoEm.toISOString(),
    observacoes: registro.observacoesDecisao,
  };
}

/** Linha da lista do histórico — resumo sem o snapshot (RN-052). */
export function apresentarResumoHistorico(item: ResumoSugestaoAporte): SugestaoHistoricoItemApi {
  return {
    id: item.id,
    data: item.data.toISOString(),
    valorDisponivel: item.valorDisponivel,
    decisaoUsuario: item.decisaoUsuario,
    decisaoEm: item.decisaoEm === null ? null : item.decisaoEm.toISOString(),
    resumo: item.resumo,
  };
}

/** Detalhe: o snapshot da criação (RN-025) com a decisão e a observação (RN-053). */
export function apresentarDetalheSugestao(
  registro: SugestaoAporteRegistro,
): SugestaoDetalheApi {
  return {
    ...apresentarSugestao(registro),
    decisaoUsuario: registro.decisaoUsuario,
    decisaoEm: registro.decisaoEm === null ? null : registro.decisaoEm.toISOString(),
    observacoes: registro.observacoesDecisao,
  };
}
