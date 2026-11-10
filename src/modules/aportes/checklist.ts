import { Decimal } from "../../lib/decimal";
import { classificarDesvio } from "../alocacao/metas";
import { normalizarReferencia } from "../risco/limites";
import type { DimensaoConcentracao, LimiteRegistro } from "../risco/repositorio";
import type { CandidatoAporte } from "./repositorio";
import type {
  ChecklistAporte,
  ClassificacaoAporte,
  ItemTresEstados,
} from "./tipos";

/**
 * Checklist e classificação dos candidatos (RN-050, RN-051, RN-055, RN-056;
 * RN-025-3).
 *
 * Oito verificações por ativo:
 * - `classeAbaixoMeta` e `segmentoAbaixoMeta` usam o desvio pós-aporte com a
 *   tolerância de 0,5 p.p. (RN-090);
 * - `aumentaConcentracao` projeta o segmento (ou o ativo, assumindo a parcela
 *   do segmento) contra o limite vigente de RN-049; sem limite → `INDISPONIVEL`;
 * - `dadosSuficientes` e `precoDentroParametros` ficam `INDISPONIVEL` até a
 *   Fase 3; `atendeQualidade`, até a Fase 4. Ausência nunca vira "SIM" (RN-077);
 * - `ativoJaNaCarteira` e `alertaRelevante` são booleanos.
 *
 * "Apto para estudo" significa "sem bloqueio conhecido", não "aprovado"
 * (RN-055/RN-056: nunca recomendar apenas por P/VP ou DY).
 */

export interface ContextoChecklist {
  /** Patrimônio atual com 2 casas. */
  readonly totalAtual: string;
  /** Patrimônio pós-aporte com 2 casas. */
  readonly totalPosAporte: string;
  /** Desvio da classe em p.p. com 6 casas, por código da classe. */
  readonly desvioClasse: ReadonlyMap<string, string>;
  /** Desvio do segmento em p.p. com 6 casas, por código do segmento. */
  readonly desvioSegmento: ReadonlyMap<string, string>;
  /** Valor atual do segmento com 2 casas, por id do segmento. */
  readonly valorSegmentoAtual: ReadonlyMap<string, string>;
  /** Valor sugerido para o segmento com 2 casas, por código do segmento. */
  readonly aporteSegmento: ReadonlyMap<string, string>;
  readonly limites: readonly LimiteRegistro[];
}

export interface AvaliacaoCandidato {
  readonly classificacao: ClassificacaoAporte;
  readonly checklist: ChecklistAporte;
  readonly motivos: readonly string[];
}

const ESCALA_PERCENTUAL = 6;

/** Resolve o limite específico da referência; ausente, cai no default da dimensão. */
export function resolverLimite(
  limites: readonly LimiteRegistro[],
  dimensao: DimensaoConcentracao,
  referencia: string | null,
): Decimal | null {
  const normalizada = normalizarReferencia(referencia);
  let padrao: Decimal | null = null;

  for (const limite of limites) {
    if (limite.dimensao !== dimensao) {
      continue;
    }

    const alvo = normalizarReferencia(limite.referencia);
    if (alvo === null) {
      padrao = Decimal.from(limite.percentualMax);
      continue;
    }

    if (normalizada !== null && alvo.toLowerCase() === normalizada.toLowerCase()) {
      return Decimal.from(limite.percentualMax);
    }
  }

  return padrao;
}

function percentual(valor: Decimal, base: Decimal): Decimal {
  return base.isZero() ? Decimal.zero(ESCALA_PERCENTUAL) : valor.mul("100").div(base, ESCALA_PERCENTUAL);
}

interface ProjecaoConcentracao {
  readonly estado: ItemTresEstados;
  readonly alerta: boolean;
  readonly motivo: string;
}

function projetarConcentracao(
  candidato: CandidatoAporte,
  contexto: ContextoChecklist,
): ProjecaoConcentracao {
  const totalAtual = Decimal.from(contexto.totalAtual);
  const totalPos = Decimal.from(contexto.totalPosAporte);
  const aporteSegmento = Decimal.from(
    candidato.segmentoCodigo === null
      ? "0.00"
      : (contexto.aporteSegmento.get(candidato.segmentoCodigo) ?? "0.00"),
  );

  const limiteSegmento = resolverLimite(
    contexto.limites,
    "SEGMENTO",
    candidato.segmentoCodigo,
  );
  if (limiteSegmento !== null && candidato.segmentoId !== null) {
    const atual = Decimal.from(contexto.valorSegmentoAtual.get(candidato.segmentoId) ?? "0.00");
    const projetado = atual.add(aporteSegmento);
    return {
      estado: percentual(projetado, totalPos).gt(limiteSegmento) ? "SIM" : "NAO",
      alerta: percentual(atual, totalAtual).gt(limiteSegmento),
      motivo: `Limite de concentração do segmento ${candidato.segmentoCodigo ?? ""}: ${limiteSegmento.toFixed(2)}%.`,
    };
  }

  const limiteAtivo = resolverLimite(contexto.limites, "ATIVO", candidato.ticker);
  if (limiteAtivo !== null) {
    const atual = Decimal.from(candidato.valorAtual);
    const projetado = atual.add(aporteSegmento);
    return {
      estado: percentual(projetado, totalPos).gt(limiteAtivo) ? "SIM" : "NAO",
      alerta: percentual(atual, totalAtual).gt(limiteAtivo),
      motivo: `Limite de concentração do ativo ${candidato.ticker}: ${limiteAtivo.toFixed(2)}%.`,
    };
  }

  return {
    estado: "INDISPONIVEL",
    alerta: false,
    motivo:
      "Sem limite de concentração configurado para o segmento ou o ativo — item não avaliado.",
  };
}

function desvioEmPontos(valor: string | undefined): Decimal | null {
  return valor === undefined ? null : Decimal.from(valor);
}

export function avaliarCandidato(
  candidato: CandidatoAporte,
  contexto: ContextoChecklist,
): AvaliacaoCandidato {
  const classeDesvio = desvioEmPontos(contexto.desvioClasse.get(candidato.classeCodigo));
  const segmentoDesvio =
    candidato.segmentoCodigo === null
      ? null
      : desvioEmPontos(contexto.desvioSegmento.get(candidato.segmentoCodigo));

  const classeAbaixoMeta =
    classeDesvio !== null && classificarDesvio(classeDesvio) === "ABAIXO";
  const segmentoAbaixoMeta =
    segmentoDesvio !== null && classificarDesvio(segmentoDesvio) === "ABAIXO";

  const projecao = projetarConcentracao(candidato, contexto);
  const motivos: string[] = [];

  if (candidato.status !== "ATIVO") {
    motivos.push("Ativo inativo ou em análise: sem dados suficientes para avaliar (RN-051).");
  }
  if (candidato.segmentoCodigo === null || segmentoDesvio === null) {
    motivos.push("Ativo sem segmento definido: sem dados suficientes para avaliar (RN-051).");
  }

  if (classeDesvio !== null) {
    if (classeAbaixoMeta) {
      motivos.push(
        `Classe ${candidato.classeCodigo} está ${classeDesvio.abs().toFixed(2)} p.p. abaixo da meta.`,
      );
    } else if (classificarDesvio(classeDesvio) === "ACIMA") {
      motivos.push(
        `Classe ${candidato.classeCodigo} está ${classeDesvio.abs().toFixed(2)} p.p. acima da meta.`,
      );
    } else {
      motivos.push(`Classe ${candidato.classeCodigo} está dentro da tolerância de 0,5 p.p.`);
    }
  }

  if (segmentoDesvio !== null && candidato.segmentoCodigo !== null) {
    const situacao = classificarDesvio(segmentoDesvio);
    if (situacao === "ABAIXO") {
      motivos.push(
        `Segmento ${candidato.segmentoCodigo} está ${segmentoDesvio.abs().toFixed(2)} p.p. abaixo da meta.`,
      );
    } else if (situacao === "ACIMA") {
      motivos.push(
        `Segmento ${candidato.segmentoCodigo} está ${segmentoDesvio.abs().toFixed(2)} p.p. acima da meta.`,
      );
    }
  }

  if (candidato.naCarteira) {
    motivos.push("Ativo já está na carteira.");
  }

  motivos.push(projecao.motivo);
  motivos.push(
    "Preço e suficiência de dados ficam indisponíveis até a Fase 3; qualidade, até a Fase 4 (RN-055/RN-056).",
  );

  const checklist: ChecklistAporte = {
    classeAbaixoMeta,
    segmentoAbaixoMeta,
    ativoJaNaCarteira: candidato.naCarteira,
    aumentaConcentracao: projecao.estado,
    dadosSuficientes: "INDISPONIVEL",
    atendeQualidade: "INDISPONIVEL",
    alertaRelevante: projecao.alerta,
    precoDentroParametros: "INDISPONIVEL",
  };

  return {
    checklist,
    motivos,
    classificacao: classificarCandidato(candidato, classeDesvio, segmentoDesvio, checklist),
  };
}

function classificarCandidato(
  candidato: CandidatoAporte,
  classeDesvio: Decimal | null,
  segmentoDesvio: Decimal | null,
  checklist: ChecklistAporte,
): ClassificacaoAporte {
  if (
    candidato.status !== "ATIVO" ||
    candidato.segmentoCodigo === null ||
    classeDesvio === null ||
    segmentoDesvio === null
  ) {
    return "SEM_DADOS_SUFICIENTES";
  }

  const situacaoClasse = classificarDesvio(classeDesvio);
  if (situacaoClasse === "DENTRO") {
    return "DENTRO_META";
  }
  if (situacaoClasse === "ACIMA") {
    return "ACIMA_META";
  }

  const riscos =
    checklist.aumentaConcentracao === "SIM" ||
    checklist.alertaRelevante ||
    !checklist.segmentoAbaixoMeta;

  return riscos ? "ABAIXO_META_COM_RISCOS" : "ABAIXO_META_APTO_PARA_ESTUDO";
}
