import type { ApiError } from "@/src/lib/api-client";
import { Decimal } from "@/src/lib/decimal";
import type { ConcentracaoApi, LimiteApi } from "@/src/modules/risco/apresentacao";

/**
 * Tipos e regras de forma da tela de configurações (RN-049-4; UI_SPEC §14.1,
 * §16–§19; API_CONTRACTS.md §12–§12.2).
 *
 * Fora de `src/modules/**` de propósito: aqui vivem rótulo, máscara e mensagem
 * — a validação autoritativa do limite continua no servidor. Os números vêm
 * sempre como string decimal do contrato; nenhuma regra é recalculada com
 * `number`.
 */

export type DimensaoLimite = "ATIVO" | "GESTORA" | "SEGMENTO" | "EMISSOR" | "IMOVEL";

export interface DimensaoUi {
  readonly valor: DimensaoLimite;
  readonly rotulo: string;
  readonly referenciaRotulo: string;
  readonly referenciaDica: string;
}

/**
 * Dimensões suportadas (API_CONTRACTS.md §12.2), na ordem em que o painel
 * apresenta os grupos. `IMOVEL` já aceita limite, mas fica indisponível até a
 * Fase 3/4 (RN-049-3).
 */
export const DIMENSOES_UI: readonly DimensaoUi[] = [
  {
    valor: "ATIVO",
    rotulo: "Ativo",
    referenciaRotulo: "Ticker do ativo",
    referenciaDica: "Ex.: HGLG11. Vazio vale para qualquer ativo.",
  },
  {
    valor: "GESTORA",
    rotulo: "Gestora",
    referenciaRotulo: "Nome da gestora",
    referenciaDica: "Ex.: CSHG. Vazio vale para qualquer gestora.",
  },
  {
    valor: "SEGMENTO",
    rotulo: "Segmento",
    referenciaRotulo: "Código do segmento",
    referenciaDica: "Ex.: LOGISTICA. Vazio vale para qualquer segmento.",
  },
  {
    valor: "EMISSOR",
    rotulo: "Emissor",
    referenciaRotulo: "Instituição emissora",
    referenciaDica: "Ex.: Banco Inter. Vazio vale para qualquer emissor.",
  },
  {
    valor: "IMOVEL",
    rotulo: "Imóvel",
    referenciaRotulo: "Identificação do imóvel",
    referenciaDica:
      "Indisponível até a Fase 3/4. O limite fica preparado para quando a dimensão existir.",
  },
];

const TAMANHO_MAXIMO_REFERENCIA = 120;
const ESCALA_PERCENTUAL = 6;

export function rotuloDimensao(dimensao: string): string {
  return DIMENSOES_UI.find((item) => item.valor === dimensao)?.rotulo ?? dimensao;
}

export function dicaReferencia(dimensao: string): string {
  return (
    DIMENSOES_UI.find((item) => item.valor === dimensao)?.referenciaDica ??
    "Vazio vale como padrão da dimensão."
  );
}

// ---------------------------------------------------------------------------
// Linhas do formulário
// ---------------------------------------------------------------------------

export interface LinhaLimiteForm {
  readonly id: string;
  readonly dimensao: string;
  readonly referencia: string;
  /** Texto editável em PT-BR (`"20"`, `"7,5"`). */
  readonly percentual: string;
}

let sequencia = 0;

export function novaLinha(dimensao: string = "ATIVO"): LinhaLimiteForm {
  sequencia += 1;
  return { id: `l${sequencia}`, dimensao, referencia: "", percentual: "" };
}

export function linhasDoVigente(vigente: readonly LimiteApi[]): LinhaLimiteForm[] {
  return vigente.map((limite) => ({
    ...novaLinha(limite.dimensao),
    referencia: limite.referencia ?? "",
    percentual: formatarEntradaPercentual(limite.percentualMax),
  }));
}

export type CampoLimite = "dimensao" | "referencia" | "percentual";

export interface ErrosLinhaLimite {
  readonly dimensao?: string;
  readonly referencia?: string;
  readonly percentual?: string;
}

export type MapaErrosLimite = Readonly<Record<string, ErrosLinhaLimite>>;

/** `id` estável do campo para `label`, `aria-invalid` e foco no primeiro erro. */
export function idDoCampo(linhaId: string, campo: CampoLimite): string {
  return `limite-${linhaId}-${campo}`;
}

/**
 * Percentual de limite: estritamente maior que 0 e até 100 (RN-049-1/2).
 *
 * Texto vazio é inválido: um limite sem percentual não existe. Texto inválido
 * devolve `null` e a tela bloqueia o salvamento sem apagar o que foi digitado
 * (UI_SPEC §16).
 */
export function lerPercentualLimite(texto: string): Decimal | null {
  const bruto = texto.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (bruto === "" || !/^\d+(?:\.\d+)?$/.test(bruto)) {
    return null;
  }

  const parsed = Decimal.parse(bruto);
  if (!parsed.ok) {
    return null;
  }

  if (!parsed.value.gt("0") || parsed.value.gt("100")) {
    return null;
  }

  return parsed.value;
}

export function normalizarReferencia(texto: string): string | null {
  const normalizado = texto.trim().replace(/\s+/g, " ");
  return normalizado === "" ? null : normalizado;
}

/** Percentual para o contrato (`"20.000000"`); inválido vira zero e é bloqueado antes do envio. */
export function percentualParaApi(texto: string): string {
  return (lerPercentualLimite(texto) ?? Decimal.zero(ESCALA_PERCENTUAL)).toFixed(
    ESCALA_PERCENTUAL,
  );
}

/**
 * Validação local do conjunto (espelha limites.ts sem substituir o servidor).
 *
 * Marca percentual fora da faixa, referência longa e duplicidade de
 * `(dimensao, referencia)` sem diferenciar caixa — o servidor continua sendo a
 * autoridade e pode recusar por qualquer um desses campos (422).
 */
export function validarLinhas(linhas: readonly LinhaLimiteForm[]): MapaErrosLimite {
  const erros: Record<string, ErrosLinhaLimite> = {};
  const vistos = new Set<string>();

  const marcar = (id: string, campo: CampoLimite, mensagem: string) => {
    erros[id] = { ...erros[id], [campo]: mensagem };
  };

  for (const linha of linhas) {
    const dimensao = linha.dimensao.trim().toUpperCase();

    if (!DIMENSOES_UI.some((item) => item.valor === dimensao)) {
      marcar(linha.id, "dimensao", "Selecione uma dimensão válida.");
    }

    const referencia = normalizarReferencia(linha.referencia);
    if (referencia !== null && referencia.length > TAMANHO_MAXIMO_REFERENCIA) {
      marcar(
        linha.id,
        "referencia",
        `A referência deve ter no máximo ${TAMANHO_MAXIMO_REFERENCIA} caracteres.`,
      );
    }

    if (lerPercentualLimite(linha.percentual) === null) {
      marcar(
        linha.id,
        "percentual",
        linha.percentual.trim() === ""
          ? "Informe o percentual máximo."
          : "Informe um percentual maior que 0 e até 100.",
      );
    }

    const chave = `${dimensao}|${(referencia ?? "").toLowerCase()}`;
    if (vistos.has(chave)) {
      marcar(
        linha.id,
        "referencia",
        "Já existe um limite para esta dimensão e referência.",
      );
    }
    vistos.add(chave);
  }

  return erros;
}

const CAMPOS_EM_ORDEM: readonly CampoLimite[] = ["dimensao", "referencia", "percentual"];

export interface FocoCampo {
  readonly linhaId: string;
  readonly campo: CampoLimite;
}

/** Primeiro campo inválido na ordem visual — recebe foco após o submit (UI_SPEC §16). */
export function primeiroCampoComErro(
  linhas: readonly LinhaLimiteForm[],
  erros: MapaErrosLimite,
): FocoCampo | null {
  for (const linha of linhas) {
    const errosDaLinha = erros[linha.id];
    if (errosDaLinha === undefined) {
      continue;
    }
    const campo = CAMPOS_EM_ORDEM.find((item) => errosDaLinha[item] !== undefined);
    if (campo !== undefined) {
      return { linhaId: linha.id, campo };
    }
  }
  return null;
}

export interface LimitePayload {
  readonly dimensao: string;
  readonly referencia: string | null;
  readonly percentualMax: string;
}

export interface PayloadLimites {
  readonly limites: readonly LimitePayload[];
}

/** `PUT` recebe sempre o conjunto completo; lista vazia remove todos os limites. */
export function montarPayload(linhas: readonly LinhaLimiteForm[]): PayloadLimites {
  return {
    limites: linhas.map((linha) => ({
      dimensao: linha.dimensao.trim().toUpperCase(),
      referencia: normalizarReferencia(linha.referencia),
      percentualMax: percentualParaApi(linha.percentual),
    })),
  };
}

// ---------------------------------------------------------------------------
// Erros do servidor
// ---------------------------------------------------------------------------

const REGEX_CAMPO_SERVIDOR = /^limites\[(\d+)\]\.(dimensao|referencia|percentualMax)$/;

export function mensagemDoCampo(campo: CampoLimite): string {
  if (campo === "percentual") {
    return "O percentual deve ser maior que 0 e até 100.";
  }
  if (campo === "referencia") {
    return "Referência inválida ou repetida para esta dimensão.";
  }
  return "Selecione uma dimensão válida.";
}

/**
 * Traduz `details.campo` (`limites[3].percentualMax`) para a linha e o campo da
 * tela (API_CONTRACTS.md §12.2). Índice inexistente devolve `null` — a tela cai
 * no alerta genérico em vez de marcar a linha errada.
 */
export function mapearCampoDoServidor(
  error: ApiError,
  linhas: readonly LinhaLimiteForm[],
): FocoCampo | null {
  const campo = error.details?.campo;
  if (typeof campo !== "string") {
    return null;
  }

  const partes = REGEX_CAMPO_SERVIDOR.exec(campo);
  if (partes === null) {
    return null;
  }

  const linha = linhas[Number(partes[1])];
  if (linha === undefined) {
    return null;
  }

  return {
    linhaId: linha.id,
    campo: partes[2] === "percentualMax" ? "percentual" : (partes[2] as CampoLimite),
  };
}

/** Erros por campo a partir do foco devolvido pelo servidor. */
export function errosDoServidor(
  linhas: readonly LinhaLimiteForm[],
  foco: FocoCampo,
): MapaErrosLimite {
  const linha = linhas.find((item) => item.id === foco.linhaId);
  if (linha === undefined) {
    return {};
  }
  return { [linha.id]: { [foco.campo]: mensagemDoCampo(foco.campo) } };
}

// ---------------------------------------------------------------------------
// Formatação (string decimal do contrato — nunca `number`)
// ---------------------------------------------------------------------------

/** Valor do contrato para o campo editável (`"20.000000"` → `"20"`). */
export function formatarEntradaPercentual(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "";
  }

  return parsed.value
    .toFixed(ESCALA_PERCENTUAL)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

/** Percentual com até 2 casas e sem zeros à direita (`"10.656000"` → `"10,66%"`). */
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

/** Pontos percentuais sem zeros à direita (`"5.000000"` → `"5"`). */
export function formatarPontosPercentuais(valor: string): string {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return "Indisponível";
  }

  return parsed.value
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

/** Dinheiro em BRL a partir da string decimal do contrato (`"16235.00"`). */
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
// Painel de concentração
// ---------------------------------------------------------------------------

/** Nenhuma posição em nenhuma dimensão disponível (carteira vazia). */
export function carteiraVazia(concentracao: ConcentracaoApi): boolean {
  return concentracao.dimensoes.every(
    (dimensao) => !dimensao.disponivel || dimensao.itens.length === 0,
  );
}
