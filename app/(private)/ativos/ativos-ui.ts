import {
  cnpjValido,
  normalizarTicker,
  tickerValido,
} from "@/src/modules/ativos/validadores";
import { errosPorCampo, type ApiError } from "@/src/lib/api-client";

/**
 * Tipos e regras de forma compartilhados pelas telas de ativos (RN-010-4/5).
 *
 * Ficam fora de `src/modules/**` de propósito: são forma de UI (máscara,
 * rótulo, mensagem) e não regra de negócio. A validação autoritativa continua
 * nos casos de uso do servidor; aqui só se antecipa o que dá para checar sem
 * duplicar o domínio.
 */

export const TAMANHO_PAGINA = 20;

/** Limites de forma espelhados do contrato (§3.1–§3.2); usados na UI e na validação local. */
export const BUSCA_MAX = 160;
export const TICKER_MIN = 4;
export const TICKER_MAX = 20;
export const NOME_ATIVO_MIN = 3;
export const NOME_ATIVO_MAX = 160;
export const FONTE_DADOS_MAX = 60;
export const OBSERVACOES_MAX = 1000;
export const CNPJ_MASCARADO_MAX = 18;

export type StatusAtivo = "ATIVO" | "INATIVO" | "EM_ANALISE";

export type OrdenacaoAtivo = "ticker" | "nome" | "status" | "criadoEm";

export type DirecaoOrdem = "asc" | "desc";

export interface SegmentoApi {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface ClasseApi {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface ClasseReferenciaApi extends ClasseApi {
  readonly segmentos: readonly SegmentoApi[];
}

export interface ReferenciaAtivosApi {
  readonly classes: readonly ClasseReferenciaApi[];
}

export interface PosicaoApi {
  readonly quantidade: string;
  readonly precoMedio: string;
}

export interface AtivoResumoApi {
  readonly id: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: ClasseApi;
  readonly segmento: SegmentoApi | null;
  readonly status: StatusAtivo;
  readonly posicao: PosicaoApi | null;
}

export interface AtivoDetalheApi extends AtivoResumoApi {
  readonly cnpj: string | null;
  readonly administrador: string | null;
  readonly gestor: string | null;
  readonly fonteDados: string | null;
  readonly observacoes: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly rendimentosAcumulados: string;
  readonly ultimosPrecos: readonly unknown[];
}

export interface MetaListaApi {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListaAtivosApi {
  readonly data: readonly AtivoResumoApi[];
  readonly meta: MetaListaApi;
}

export const ROTULOS_STATUS: Readonly<Record<StatusAtivo, string>> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  EM_ANALISE: "Em análise",
};

export const OPCOES_STATUS: readonly { readonly valor: StatusAtivo; readonly rotulo: string }[] = [
  { valor: "ATIVO", rotulo: "Ativo" },
  { valor: "INATIVO", rotulo: "Inativo" },
  { valor: "EM_ANALISE", rotulo: "Em análise" },
];

export const TONS_STATUS: Readonly<
  Record<StatusAtivo, "success" | "neutral" | "warning">
> = {
  ATIVO: "success",
  INATIVO: "neutral",
  EM_ANALISE: "warning",
};

export const OPCOES_ORDENACAO: readonly {
  readonly valor: `${OrdenacaoAtivo}:${DirecaoOrdem}`;
  readonly rotulo: string;
}[] = [
  { valor: "ticker:asc", rotulo: "Ticker (A–Z)" },
  { valor: "ticker:desc", rotulo: "Ticker (Z–A)" },
  { valor: "nome:asc", rotulo: "Nome (A–Z)" },
  { valor: "nome:desc", rotulo: "Nome (Z–A)" },
  { valor: "status:asc", rotulo: "Status (A–Z)" },
  { valor: "status:desc", rotulo: "Status (Z–A)" },
];

/** Rótulo do status com o texto sempre presente (UI_SPEC §18). */
export function rotuloStatus(status: StatusAtivo): string {
  return ROTULOS_STATUS[status] ?? status;
}

/** Classificação FII é a única que exige segmento (RN-010, DATA_MODEL §4.4). */
export function ehClasseFii(classe: ClasseApi | null | undefined): boolean {
  return classe?.codigo === "FII";
}

// ---------------------------------------------------------------------------
// CNPJ — máscara e dígito verificador
// ---------------------------------------------------------------------------

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Máscara progressiva `00.000.000/0000-00` sobre no máximo 14 dígitos. */
export function mascararCnpj(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 14);
  let saida = digitos.slice(0, 2);
  if (digitos.length > 2) {
    saida += `.${digitos.slice(2, 5)}`;
  }
  if (digitos.length > 5) {
    saida += `.${digitos.slice(5, 8)}`;
  }
  if (digitos.length > 8) {
    saida += `/${digitos.slice(8, 12)}`;
  }
  if (digitos.length > 12) {
    saida += `-${digitos.slice(12, 14)}`;
  }
  return saida;
}

/** Exibição de CNPJ completo ou `null`; nunca mostra parcial como se fosse válido. */
export function formatarCnpj(valor: string | null): string {
  return valor === null ? "Não informado" : mascararCnpj(valor);
}

// ---------------------------------------------------------------------------
// Validações de forma (espelham UI_SPEC §6.2 e ERROR_CATALOG §4)
// ---------------------------------------------------------------------------

export function validarTicker(valor: string): string | null {
  const ticker = normalizarTicker(valor);
  if (ticker === "") {
    return "Informe o ticker.";
  }
  if (!tickerValido(ticker)) {
    return `Ticker inválido. Use de ${TICKER_MIN} a ${TICKER_MAX} caracteres alfanuméricos.`;
  }
  return null;
}

export function validarNomeAtivo(valor: string): string | null {
  const nome = valor.trim();
  if (nome === "") {
    return "Informe o nome do ativo.";
  }
  if (nome.length < NOME_ATIVO_MIN) {
    return `O nome deve ter pelo menos ${NOME_ATIVO_MIN} caracteres.`;
  }
  if (nome.length > NOME_ATIVO_MAX) {
    return `O nome deve ter no máximo ${NOME_ATIVO_MAX} caracteres.`;
  }
  return null;
}

/** Vazio é aceito (campo opcional); com conteúdo exige os dois dígitos verificadores. */
export function validarCnpjAtivo(valor: string): string | null {
  const digitos = somenteDigitos(valor);
  if (digitos === "") {
    return null;
  }
  return cnpjValido(digitos) ? null : "CNPJ inválido.";
}

export function validarTamanhoOpcional(
  valor: string,
  maximo: number,
  rotulo: string,
): string | null {
  return valor.trim().length > maximo ? `${rotulo} deve ter no máximo ${maximo} caracteres.` : null;
}

export function validarObservacoes(valor: string): string | null {
  return valor.trim().length > OBSERVACOES_MAX
    ? `As observações devem ter no máximo ${OBSERVACOES_MAX} caracteres.`
    : null;
}

// ---------------------------------------------------------------------------
// Erros do envelope (details.errors[].field + códigos sem campo)
// ---------------------------------------------------------------------------

export interface ErrosAtivo {
  ticker?: string;
  nome?: string;
  classeId?: string;
  segmentoId?: string;
  cnpj?: string;
  administrador?: string;
  gestor?: string;
  fonteDados?: string;
  observacoes?: string;
}

/**
 * Converte o envelope no mapa de erros por campo.
 *
 * Os códigos de ativo do catálogo não carregam `details.errors`; sem este
 * mapeamento o titular veria só um alerta genérico e não saberia qual campo
 * corrigir (UI_SPEC §16).
 */
export function mapaDeErrosDoAtivo(error: ApiError): Record<string, string> {
  switch (error.code) {
    case "ATIVO_TICKER_DUPLICADO":
    case "ATIVO_TICKER_INVALIDO":
      return { ticker: error.message };
    case "ATIVO_SEGMENTO_OBRIGATORIO":
    case "ATIVO_SEGMENTO_INVALIDO":
      return { segmentoId: error.message };
    case "ATIVO_CNPJ_INVALIDO":
      return { cnpj: error.message };
    case "ATIVO_CLASSE_INVALIDA":
      return { classeId: error.message };
    default:
      return errosPorCampo(error);
  }
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return "Não informado";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

export function valorOuNaoInformado(valor: string | null): string {
  const normalizado = valor?.trim() ?? "";
  return normalizado === "" ? "Não informado" : normalizado;
}
