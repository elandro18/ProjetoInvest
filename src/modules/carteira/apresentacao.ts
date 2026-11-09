import type {
  CarteiraConsolidada,
  CotacoesCarteira,
  ItemDistribuicaoCarteira,
  PosicaoCarteiraConsolidada,
  ReferenciaPosicaoCarteira,
  ResumoCarteira,
} from "./consolidar-carteira";
import type { EvolucaoCarteira, PontoEvolucaoCarteira } from "./evolucao-carteira";

/**
 * Forma pública da carteira (API_CONTRACTS.md §5.1–§5.2).
 *
 * Todos os valores monetários e percentuais saem como string decimal; o
 * `diagnostico` interno de consistência não é exposto. `consistente` é um
 * sinal aditivo de saúde do agregado (a soma das classes bate com o total).
 */

export interface ResumoCarteiraApi {
  readonly patrimonioTotal: string;
  readonly rendaFixa: string;
  readonly fiis: string;
  readonly percentualRendaFixa: string;
  readonly percentualFiis: string;
  readonly quantidadeAtivos: number;
  readonly rendimentosMes: string;
  readonly rendimentosAcumuladosAno: string;
}

export interface ItemDistribuicaoApi {
  readonly codigo: string;
  readonly nome: string;
  readonly valor: string;
  readonly percentual: string;
  readonly valorIndisponivel: boolean;
}

export interface CarteiraApi {
  readonly resumo: ResumoCarteiraApi;
  readonly porClasse: readonly ItemDistribuicaoApi[];
  readonly porSegmento: readonly ItemDistribuicaoApi[];
  readonly posicoes: readonly PosicaoApi[];
  readonly consistente: boolean;
  readonly atualizadoEm: string;
  readonly cotacoes: CotacoesCarteira;
}

/** Linha da tabela de posições (RN-020-5; API_CONTRACTS.md §5.1). */
export interface PosicaoApi {
  readonly ativoId: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: ReferenciaPosicaoCarteira;
  readonly segmento: ReferenciaPosicaoCarteira | null;
  readonly quantidade: string;
  readonly precoMedio: string;
  readonly custoTotal: string;
  readonly valorAtual: string;
  readonly valorIndisponivel: boolean;
  readonly percentual: string;
}

export interface PontoEvolucaoApi {
  readonly data: string;
  readonly patrimonio: string;
  readonly rendaFixa: string;
  readonly fiis: string;
}

export interface EvolucaoApi {
  readonly pontos: readonly PontoEvolucaoApi[];
}

function apresentarResumo(resumo: ResumoCarteira): ResumoCarteiraApi {
  return {
    patrimonioTotal: resumo.patrimonioTotal,
    rendaFixa: resumo.rendaFixa,
    fiis: resumo.fiis,
    percentualRendaFixa: resumo.percentualRendaFixa,
    percentualFiis: resumo.percentualFiis,
    quantidadeAtivos: resumo.quantidadeAtivos,
    rendimentosMes: resumo.rendimentosMes,
    rendimentosAcumuladosAno: resumo.rendimentosAcumuladosAno,
  };
}

function apresentarItem(item: ItemDistribuicaoCarteira): ItemDistribuicaoApi {
  return {
    codigo: item.codigo,
    nome: item.nome,
    valor: item.valor,
    percentual: item.percentual,
    valorIndisponivel: item.valorIndisponivel,
  };
}

function apresentarPosicao(posicao: PosicaoCarteiraConsolidada): PosicaoApi {
  return {
    ativoId: posicao.ativoId,
    ticker: posicao.ticker,
    nome: posicao.nome,
    classe: { codigo: posicao.classe.codigo, nome: posicao.classe.nome },
    segmento:
      posicao.segmento === null
        ? null
        : { codigo: posicao.segmento.codigo, nome: posicao.segmento.nome },
    quantidade: posicao.quantidade,
    precoMedio: posicao.precoMedio,
    custoTotal: posicao.custoTotal,
    valorAtual: posicao.valorAtual,
    valorIndisponivel: posicao.valorIndisponivel,
    percentual: posicao.percentual,
  };
}

export function apresentarCarteira(carteira: CarteiraConsolidada): CarteiraApi {
  return {
    resumo: apresentarResumo(carteira.resumo),
    porClasse: carteira.porClasse.map(apresentarItem),
    porSegmento: carteira.porSegmento.map(apresentarItem),
    posicoes: carteira.posicoes.map(apresentarPosicao),
    consistente: carteira.consistente,
    atualizadoEm: carteira.atualizadoEm,
    cotacoes: {
      statusDado: carteira.cotacoes.statusDado,
      dataReferencia: carteira.cotacoes.dataReferencia,
    },
  };
}

function apresentarPonto(ponto: PontoEvolucaoCarteira): PontoEvolucaoApi {
  return {
    data: ponto.data,
    patrimonio: ponto.patrimonio,
    rendaFixa: ponto.rendaFixa,
    fiis: ponto.fiis,
  };
}

export function apresentarEvolucao(evolucao: EvolucaoCarteira): EvolucaoApi {
  return { pontos: evolucao.pontos.map(apresentarPonto) };
}
