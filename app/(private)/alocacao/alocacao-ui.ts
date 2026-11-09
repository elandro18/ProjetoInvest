import type { StatusBadgeTone } from "@/src/components/ui/status-badge";
import { Decimal } from "@/src/lib/decimal";
import type { ItemDesvio } from "@/src/modules/alocacao/calcular-desvios";
import type {
  DesviosApi,
  MetasVigentesApi,
} from "@/src/modules/alocacao/apresentacao";

/**
 * Tipos e regras de forma da tela de alocação (RN-021-4; UI_SPEC §9).
 *
 * Fora de `src/modules/**` de propósito: aqui vivem rótulo, máscara e mensagem
 * — a validação autoritativa da soma continua no servidor. Os limiares e a
 * classificação de situação vêm do contrato (`API_CONTRACTS.md §7.3`), nunca
 * são recalculados com `number`.
 */

export type EscopoMeta = "CLASSE" | "SEGMENTO";

export type SituacaoDesvio = ItemDesvio["situacao"];

export interface LinhaMetaForm {
  readonly id: string;
  readonly codigo: string;
  /** Texto editável em PT-BR (`"50"`, `"7,5"`). */
  readonly percentual: string;
}

export interface SegmentoReferenciaResposta {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface ClasseReferenciaResposta {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly segmentos: readonly SegmentoReferenciaResposta[];
}

export interface ReferenciaAtivosResposta {
  readonly classes: readonly ClasseReferenciaResposta[];
}

export type { DesviosApi, ItemDesvio };

/** Rótulos do catálogo inicial (prisma/seed.ts) — fallback quando a referência falha. */
export const ROTULOS_REFERENCIA: Readonly<Record<string, string>> = {
  RENDA_FIXA: "Renda Fixa",
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

export const ROTULOS_SITUACAO: Readonly<Record<SituacaoDesvio, string>> = {
  ABAIXO: "Abaixo",
  ACIMA: "Acima",
  DENTRO: "Dentro",
};

/**
 * Semântica visual da situação (UI_SPEC §18): a cor é reforço; o texto do
 * badge é o portador do significado. "Acima" não é erro — recebe tom neutro.
 */
export const TONS_SITUACAO: Readonly<Record<SituacaoDesvio, StatusBadgeTone>> = {
  ABAIXO: "warning",
  ACIMA: "info",
  DENTRO: "success",
};

export function rotuloReferencia(
  codigo: string,
  nomes: Readonly<Record<string, string>> = {},
): string {
  return nomes[codigo] ?? ROTULOS_REFERENCIA[codigo] ?? codigo;
}

/** Converte o catálogo de referência em mapa `codigo → nome` (classes + segmentos). */
export function nomesDaReferencia(
  referencia: ReferenciaAtivosResposta,
): Readonly<Record<string, string>> {
  const nomes: Record<string, string> = {};
  for (const classe of referencia.classes) {
    nomes[classe.codigo] = classe.nome;
    for (const segmento of classe.segmentos) {
      nomes[segmento.codigo] = segmento.nome;
    }
  }
  return nomes;
}

// ---------------------------------------------------------------------------
// Percentuais
// ---------------------------------------------------------------------------

/**
 * Lê o texto digitado (PT-BR ou formato do contrato).
 *
 * Campo vazio vale zero — o contrato aceita 0% e a soma continua conferindo.
 * Texto inválido, negativo ou acima de 100 devolve `null`; a tela bloqueia o
 * salvar sem apagar o que foi digitado (UI_SPEC §16).
 */
export function lerPercentual(texto: string): Decimal | null {
  const bruto = texto.trim().replace(/\s/g, "");
  if (bruto === "") {
    return Decimal.zero(2);
  }

  const normalizado = bruto.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalizado)) {
    return null;
  }

  const parsed = Decimal.parse(normalizado);
  if (!parsed.ok) {
    return null;
  }

  if (parsed.value.lt("0") || parsed.value.gt("100")) {
    return null;
  }

  return parsed.value;
}

/** Soma em tempo real; texto inválido conta como zero para o contador. */
export function somarPercentuais(linhas: readonly LinhaMetaForm[]): Decimal {
  return linhas.reduce((total, linha) => {
    const valor = lerPercentual(linha.percentual);
    return valor === null ? total : total.add(valor);
  }, Decimal.zero(6));
}

/** IDs cujo texto não é um percentual válido (vazio é permitido). */
export function linhasInvalidas(linhas: readonly LinhaMetaForm[]): readonly string[] {
  return linhas
    .filter((linha) => linha.percentual.trim() !== "" && lerPercentual(linha.percentual) === null)
    .map((linha) => linha.id);
}

export interface AjusteSoma {
  readonly texto: string;
  readonly excede: boolean;
}

/** `null` quando a soma é exatamente 100 (regra estrutural do botão — UI_SPEC §16). */
export function ajusteDeSoma(soma: Decimal): AjusteSoma | null {
  const diferenca = soma.sub("100");
  if (diferenca.isZero()) {
    return null;
  }

  const excede = diferenca.isPositive();
  return {
    texto: `${excede ? "Excede" : "Faltam"} ${formatarPontos(diferenca.abs(), 1)} p.p.`,
    excede,
  };
}

/** Decimal para string do contrato (`"60.000000"`); inválido vira zero. */
export function percentualParaApi(texto: string): string {
  const valor = lerPercentual(texto);
  return (valor ?? Decimal.zero(6)).toFixed(6);
}

export interface PayloadMetas {
  readonly classe: readonly { readonly referenciaId: string; readonly percentual: string }[];
  readonly segmento: readonly { readonly referenciaId: string; readonly percentual: string }[];
}

export function montarPayload(
  classe: readonly LinhaMetaForm[],
  segmento: readonly LinhaMetaForm[],
): PayloadMetas {
  const paraPayload = (linhas: readonly LinhaMetaForm[]) =>
    linhas.map((linha) => ({
      referenciaId: linha.id,
      percentual: percentualParaApi(linha.percentual),
    }));

  return { classe: paraPayload(classe), segmento: paraPayload(segmento) };
}

export function linhasDaVigente(vigente: MetasVigentesApi): {
  readonly classe: LinhaMetaForm[];
  readonly segmento: LinhaMetaForm[];
} {
  return {
    classe: vigente.classe.map((meta) => ({
      id: meta.classeId,
      codigo: meta.codigo,
      percentual: formatarEntradaPercentual(meta.percentual),
    })),
    segmento: vigente.segmento.map((meta) => ({
      id: meta.segmentoId,
      codigo: meta.codigo,
      percentual: formatarEntradaPercentual(meta.percentual),
    })),
  };
}

// ---------------------------------------------------------------------------
// Números e datas
// ---------------------------------------------------------------------------

/** Valor decimal do contrato para o campo editável (`"7.500000"` → `"7,5"`). */
export function formatarEntradaPercentual(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "";
  }

  return parsed.value
    .toFixed(6)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

/** Percentual com até 2 casas e sem zeros à direita (`"40.041000"` → `"40,04%"`). */
export function formatarPercentual(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const texto = parsed.value
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${texto}%`;
}

/** Pontos percentuais fixos (`Decimal` ou string), vírgula decimal. */
export function formatarPontos(valor: string | Decimal, casas = 1): string {
  const parsed = valor instanceof Decimal ? valor : Decimal.parse(valor);
  const numero = parsed instanceof Decimal ? parsed : parsed.ok ? parsed.value : null;
  if (numero === null) {
    return "Indisponível";
  }

  return numero.toFixed(casas).replace(".", ",");
}

/** Desvio com sinal explícito (`"+10"`, `"-9,96"`), até 2 casas. */
export function formatarDesvio(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const absoluto = parsed.value
    .abs()
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${parsed.value.isNegative() ? "-" : "+"}${absoluto}`;
}

/** Dinheiro em BRL a partir da string decimal do contrato (`"15170.00"`). */
export function formatarMoeda(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const [inteiro, centavos] = parsed.value.abs().toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${parsed.value.isNegative() ? "-" : ""}R$ ${agrupado},${centavos}`;
}

// ---------------------------------------------------------------------------
// Desvios
// ---------------------------------------------------------------------------

export function itensDoEscopo(
  desvios: DesviosApi,
  escopo: EscopoMeta,
): readonly ItemDesvio[] {
  return desvios.itens.filter((item) => item.escopo === escopo);
}

/** Sem patrimônio o contrato devolve todos os percentuais atuais em zero. */
export function semPatrimonio(desvios: DesviosApi): boolean {
  return (
    desvios.itens.length > 0 &&
    desvios.itens.every((item) => {
      const atual = Decimal.parse(item.percentualAtual);
      return atual.ok && atual.value.isZero();
    })
  );
}

export function possuiValorIndisponivel(desvios: DesviosApi): boolean {
  return desvios.itens.some((item) => item.valorIndisponivel);
}
