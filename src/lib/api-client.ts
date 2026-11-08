/**
 * Cliente HTTP da UI (RN-072, ERROR_CATALOG.md §1 e §11).
 *
 * O envelope de erro `{ error: { code, message, details } }` é tratado como
 * resultado tipado — nunca lançado — para que o formulário continue no fluxo
 * esperado (marcar campo, preservar o que foi digitado, mostrar alerta).
 *
 * Falha de rede e resposta fora do envelope viram códigos sintéticos locais
 * (`ERRO_REDE`/`RESPOSTA_INVALIDA`), que não substituem o catálogo público:
 * existem só para a UI conseguir se recuperar.
 */

export interface ApiFieldError {
  readonly field: string;
  readonly message: string;
}

export interface ApiErrorDetails {
  readonly errors?: readonly ApiFieldError[];
  readonly retryAfterSegundos?: number;
  readonly podeReenviar?: boolean;
  readonly traceId?: string;
  readonly [chave: string]: unknown;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: ApiErrorDetails;
}

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly status: number;
  readonly data: T;
}

export interface ApiFailure {
  readonly ok: false;
  readonly status: number;
  readonly error: ApiError;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  readonly method?: ApiMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export const MENSAGEM_ERRO_GENERICO = "Algo deu errado. Tente novamente em instantes.";

const MENSAGEM_ERRO_REDE =
  "Não foi possível conectar. Verifique sua conexão e tente novamente.";

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function lerEnvelope(body: unknown): ApiError {
  if (ehObjeto(body) && ehObjeto(body.error) && typeof body.error.message === "string") {
    const details = ehObjeto(body.error.details)
      ? (body.error.details as ApiErrorDetails)
      : undefined;

    return {
      code: typeof body.error.code === "string" ? body.error.code : "ERRO_INTERNO",
      message: body.error.message,
      ...(details === undefined ? {} : { details }),
    };
  }

  return { code: "ERRO_INTERNO", message: MENSAGEM_ERRO_GENERICO };
}

async function lerJson(response: Response): Promise<{ lido: true; valor: unknown } | { lido: false }> {
  const texto = await response.text();
  if (texto === "") {
    return { lido: false };
  }

  try {
    return { lido: true, valor: JSON.parse(texto) as unknown };
  } catch {
    return { lido: false };
  }
}

export async function apiRequest<T>(
  caminho: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const headers = new Headers({ accept: "application/json" });
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(caminho, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") {
      throw erro;
    }

    return {
      ok: false,
      status: 0,
      error: { code: "ERRO_REDE", message: MENSAGEM_ERRO_REDE },
    };
  }

  if (response.status === 204) {
    return { ok: true, status: 204, data: undefined as T };
  }

  const json = await lerJson(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: lerEnvelope(json.lido ? json.valor : undefined),
    };
  }

  if (!json.lido) {
    return {
      ok: false,
      status: response.status,
      error: { code: "RESPOSTA_INVALIDA", message: MENSAGEM_ERRO_GENERICO },
    };
  }

  return { ok: true, status: response.status, data: json.valor as T };
}

/** Mapa `campo → primeira mensagem`, a partir de `details.errors[]` (RN-069). */
export function errosPorCampo(error: ApiError): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const item of error.details?.errors ?? []) {
    if (mapa[item.field] === undefined) {
      mapa[item.field] = item.message;
    }
  }
  return mapa;
}

/** Mensagem de 429 com o tempo de espera, quando o servidor informar. */
export function mensagemDeErro(error: ApiError): string {
  if (error.code === "RATE_LIMIT_EXCEDIDO" && error.details?.retryAfterSegundos !== undefined) {
    const segundos = Math.max(1, Math.ceil(error.details.retryAfterSegundos));
    return `Muitas tentativas. Aguarde ${segundos} s e tente novamente.`;
  }

  return error.message || MENSAGEM_ERRO_GENERICO;
}

/** Códigos de sessão que exigem novo login (ERROR_CATALOG.md §11). */
export function ehErroDeSessao(error: ApiError): boolean {
  return (
    error.code === "NAO_AUTENTICADO" ||
    error.code === "AUTH_SESSAO_EXPIRADA" ||
    error.code === "SEM_PERMISSAO"
  );
}
