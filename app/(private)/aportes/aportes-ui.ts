import type { StatusBadgeTone } from "@/src/components/ui/status-badge";
import { FUSO_SAO_PAULO } from "@/src/lib/datas";
import { Decimal } from "@/src/lib/decimal";
import type { SugestaoAporteApi } from "@/src/modules/aportes/apresentacao";
import type {
  ChecklistAporte,
  ClassificacaoAporte,
  ItemTresEstados,
  LinhaDistribuicaoSugerida,
} from "@/src/modules/aportes/tipos";

/**
 * Tipos e regras de forma da tela de aportes (RN-025-6; UI_SPEC §10, §15–§19).
 *
 * Fora de `src/modules/**` de propósito: aqui vivem rótulo, máscara e mensagem.
 * O cálculo da distribuição continua exclusivamente no servidor (RN-027) — a
 * tela só formata e soma o que o contrato devolveu.
 *
 * Princípio de interface 3 (UI_SPEC §1): ausência é informação. Item sem dado
 * aparece como "não avaliado" com o motivo, nunca como positivo (RN-077).
 */

export const ATALHOS_VALOR: readonly { readonly rotulo: string; readonly valor: string }[] = [
  { rotulo: "R$ 500", valor: "500.00" },
  { rotulo: "R$ 1.000", valor: "1000.00" },
  { rotulo: "R$ 1.500", valor: "1500.00" },
  { rotulo: "R$ 2.000", valor: "2000.00" },
];

/** Rótulos do catálogo inicial (`prisma/seed.ts`) — fallback quando o código não tem mapa. */
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

export function rotuloReferencia(codigo: string): string {
  return ROTULOS_REFERENCIA[codigo] ?? codigo;
}

// ---------------------------------------------------------------------------
// Valor disponível
// ---------------------------------------------------------------------------

/**
 * Lê o texto digitado (PT-BR ou formato do contrato).
 *
 * Sem vírgula, `"1.000"` é lido como mil — nunca como 1,0 — porque o campo é
 * monetário. Texto inválido devolve `null` e a tela mantém o que foi digitado
 * (UI_SPEC §16).
 */
export function lerValorDisponivel(texto: string): Decimal | null {
  const bruto = texto.trim().replace(/\s/g, "");
  if (bruto === "") {
    return null;
  }

  let normalizado = bruto;
  if (bruto.includes(",")) {
    normalizado = bruto.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) {
    normalizado = bruto.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(normalizado)) {
    return null;
  }

  const parsed = Decimal.parse(normalizado);
  return parsed.ok ? parsed.value : null;
}

/** `null` quando o valor é aceitável; texto de erro caso contrário. */
export function validarValorDisponivel(texto: string): string | null {
  if (texto.trim() === "") {
    return "Informe o valor disponível (ex.: 1.000,00).";
  }

  const valor = lerValorDisponivel(texto);
  if (valor === null) {
    return "Informe um valor válido (ex.: 1.234,56).";
  }

  if (!valor.isPositive() || valor.isZero()) {
    return "O valor disponível deve ser maior que zero.";
  }

  return null;
}

/** Valor do campo para a string do contrato (`"1000.00"`); inválido vira `null`. */
export function valorParaApi(texto: string): string | null {
  const valor = lerValorDisponivel(texto);
  return valor === null ? null : valor.round(2).toFixed(2);
}

/** Pré-preenchimento do campo a partir do valor do contrato (`"1500.00"` → `"1.500,00"`). */
export function formatarEntradaValor(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "";
  }

  const [inteiro, centavos] = parsed.value.abs().toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${agrupado},${centavos}`;
}

// ---------------------------------------------------------------------------
// Números e datas
// ---------------------------------------------------------------------------

/** Dinheiro em BRL a partir da string decimal do contrato (`"1000.00"`). */
export function formatarMoeda(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  const [inteiro, centavos] = parsed.value.abs().toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${parsed.value.isNegative() ? "-" : ""}R$ ${agrupado},${centavos}`;
}

/** Data/hora de negócio em São Paulo (`"10/11/2026, 09:00"`). */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO_SAO_PAULO,
  }).format(data);
}

/** Soma das linhas de uma distribuição — o contrato garante o valor exato do aporte. */
export function somarDistribuicao(linhas: readonly LinhaDistribuicaoSugerida[]): string {
  return linhas
    .reduce((total, linha) => total.add(Decimal.from(linha.valor)), Decimal.zero(2))
    .toFixed(2);
}

/**
 * Linhas que efetivamente recebem aporte.
 *
 * O detalhamento por segmento é limitado à parcela de FII (RN-027): quando a
 * classe não recebe nada, todas as linhas vêm zeradas e a justificativa fala de
 * desvio que não será corrigido neste aporte — exibir isso só confunde.
 */
export function linhasComAporte(
  linhas: readonly LinhaDistribuicaoSugerida[],
): readonly LinhaDistribuicaoSugerida[] {
  return linhas.filter((linha) => {
    const valor = Decimal.parse(linha.valor);
    return valor.ok && valor.value.gt("0");
  });
}

/**
 * Sem patrimônio: todos os percentuais atuais em zero (carteira vazia).
 * A sugestão continua válida — só a base de comparação ainda não existe.
 */
export function semPatrimonio(sugestao: SugestaoAporteApi): boolean {
  const percentuais = [
    ...sugestao.distribuicaoAtual.classe,
    ...sugestao.distribuicaoAtual.segmento,
  ];

  if (percentuais.length === 0) {
    return true;
  }

  return percentuais.every((linha) => {
    const percentual = Decimal.parse(linha.percentual);
    return percentual.ok && percentual.value.isZero();
  });
}

// ---------------------------------------------------------------------------
// Classificação dos ativos (RN-051)
// ---------------------------------------------------------------------------

interface RotuloClassificacao {
  readonly texto: string;
  readonly tone: StatusBadgeTone;
}

export const ROTULOS_CLASSIFICACAO: Readonly<Record<ClassificacaoAporte, RotuloClassificacao>> = {
  ABAIXO_META_APTO_PARA_ESTUDO: {
    texto: "Abaixo da meta — apto para estudo",
    tone: "success",
  },
  ABAIXO_META_COM_RISCOS: {
    texto: "Abaixo da meta — com riscos",
    tone: "warning",
  },
  DENTRO_META: { texto: "Dentro da meta", tone: "info" },
  ACIMA_META: { texto: "Acima da meta", tone: "neutral" },
  SEM_DADOS_SUFICIENTES: { texto: "Sem dados suficientes", tone: "neutral" },
};

export function rotuloClassificacao(
  classificacao: ClassificacaoAporte,
): RotuloClassificacao {
  return (
    ROTULOS_CLASSIFICACAO[classificacao] ?? {
      texto: "Sem dados suficientes",
      tone: "neutral",
    }
  );
}

// ---------------------------------------------------------------------------
// Checklist de oito verificações (RN-050, RN-077)
// ---------------------------------------------------------------------------

export type ValorChecklist = "ok" | "não" | "não avaliado";

interface DefinicaoItemChecklist {
  readonly chave: keyof ChecklistAporte;
  readonly rotulo: string;
  /** `true` quando o critério é positivo (SIM = situação favorável). */
  readonly positivo: boolean;
  readonly motivoIndisponivel?: string;
}

/**
 * Oito itens, na ordem de leitura do checklist. Dois critérios medem risco
 * (`aumentaConcentracao`, `alertaRelevante`): o rótulo é escrito na forma
 * positiva ("Concentração dentro do limite", "Sem alerta relevante") para que
 * `SIM` continue significando "ok" em toda a lista.
 */
export const ITENS_CHECKLIST: readonly DefinicaoItemChecklist[] = [
  { chave: "classeAbaixoMeta", rotulo: "Classe abaixo da meta", positivo: true },
  { chave: "segmentoAbaixoMeta", rotulo: "Segmento abaixo da meta", positivo: true },
  { chave: "ativoJaNaCarteira", rotulo: "Ativo já está na carteira", positivo: true },
  {
    chave: "aumentaConcentracao",
    rotulo: "Concentração dentro do limite",
    positivo: false,
    motivoIndisponivel:
      "Sem limite de concentração configurado para esta classe — configure em Configurações.",
  },
  {
    chave: "dadosSuficientes",
    rotulo: "Dados suficientes",
    positivo: true,
    motivoIndisponivel:
      "Dados de mercado ainda não são coletados nesta fase; o critério será avaliado na Fase 3.",
  },
  {
    chave: "atendeQualidade",
    rotulo: "Atende aos critérios de qualidade",
    positivo: true,
    motivoIndisponivel:
      "Os critérios de qualidade entram em vigor na Fase 4; até lá o item fica sem avaliação.",
  },
  {
    chave: "alertaRelevante",
    rotulo: "Sem alerta relevante",
    positivo: false,
  },
  {
    chave: "precoDentroParametros",
    rotulo: "Preço dentro dos parâmetros",
    positivo: true,
    motivoIndisponivel:
      "Preço, P/VP e dividend yield ainda não estão disponíveis; o critério será avaliado na Fase 3.",
  },
];

export interface ItemChecklistExibicao {
  readonly chave: keyof ChecklistAporte;
  readonly rotulo: string;
  readonly valor: ValorChecklist;
  readonly tone: StatusBadgeTone;
  readonly explicacao: string | null;
}

function valorDoItem(item: ItemTresEstados | boolean, positivo: boolean): ValorChecklist {
  const bruto = typeof item === "boolean" ? (item ? "SIM" : "NAO") : item;

  if (bruto === "INDISPONIVEL") {
    return "não avaliado";
  }

  const favoravel = positivo ? bruto === "SIM" : bruto === "NAO";
  return favoravel ? "ok" : "não";
}

/**
 * Converte o checklist do contrato para exibição (SIM→"ok", NAO→"não",
 * INDISPONIVEL→"não avaliado"). Indisponível nunca vira "ok" — RN-077.
 */
export function exibirChecklist(
  checklist: ChecklistAporte,
): readonly ItemChecklistExibicao[] {
  return ITENS_CHECKLIST.map((definicao) => {
    const valor = valorDoItem(checklist[definicao.chave], definicao.positivo);
    return {
      chave: definicao.chave,
      rotulo: definicao.rotulo,
      valor,
      tone: valor === "ok" ? "success" : "neutral",
      explicacao:
        valor === "não avaliado" ? (definicao.motivoIndisponivel ?? null) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Decisão do usuário (RN-053)
// ---------------------------------------------------------------------------

export type DecisaoAporte = "ACEITA" | "IGNORADA" | "ALTERADA";

export const ROTULOS_DECISAO: Readonly<Record<DecisaoAporte, string>> = {
  ACEITA: "Aceita",
  IGNORADA: "Ignorada",
  ALTERADA: "Alterada",
};

export const TONS_DECISAO: Readonly<Record<DecisaoAporte, StatusBadgeTone>> = {
  ACEITA: "success",
  IGNORADA: "neutral",
  ALTERADA: "info",
};

export function ehDecisaoAporte(valor: string | null): valor is DecisaoAporte {
  return valor === "ACEITA" || valor === "IGNORADA" || valor === "ALTERADA";
}

/** Estado de decisão mantido na tela depois do `PATCH` (a sugestão permanece visível). */
export interface DecisaoRegistrada {
  readonly decisao: DecisaoAporte;
  readonly em: string;
  readonly observacoes: string | null;
}
