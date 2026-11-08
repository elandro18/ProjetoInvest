import { errors } from "../../lib/errors";

/**
 * Cliente HTTP para provedores externos (RN-072 / ARCHITECTURE.md §5).
 *
 * Regras:
 * - timeout de 5 s por tentativa (`AbortSignal.timeout`);
 * - retry no máximo 2 vezes, apenas em `429` e `5xx`, com backoff exponencial;
 * - `4xx` (exceto 429) nunca é retentado;
 * - headers, token e corpo nunca são logados — este módulo não loga nada;
 * - `fetch`, o relógio de espera e o timeout são injetáveis para teste.
 */

export const DEFAULT_TIMEOUT_MS = 5_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_BACKOFF_MS = 100;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpRequestOptions {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Sinal do chamador; o timeout do cliente é combinado com ele. */
  readonly signal?: AbortSignal;
}

export interface HttpResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly body: string;
}

export interface HttpClientOptions {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly backoffMs?: number;
  readonly fetchImpl?: FetchLike;
  readonly sleepImpl?: (ms: number) => Promise<void>;
}

export interface HttpClient {
  request(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
  get(url: string, options?: Omit<HttpRequestOptions, "method">): Promise<HttpResponse>;
}

type AnyAbortSignal = (signals: AbortSignal[]) => AbortSignal;

function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** `AbortSignal.any` quando disponível; fallback para Node/TS sem o helper tipado. */
function combineSignals(signals: readonly AbortSignal[]): AbortSignal {
  const anySignal = (AbortSignal as unknown as { any?: AnyAbortSignal }).any;
  if (typeof anySignal === "function") {
    return anySignal([...signals]);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  return controller.signal;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;

  function timeoutSignal(callerSignal: AbortSignal | undefined): AbortSignal {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (callerSignal !== undefined) {
      signals.push(callerSignal);
    }
    return combineSignals(signals);
  }

  async function fetchOnce(
    url: string,
    method: string,
    headers: Readonly<Record<string, string>> | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    try {
      return await fetchImpl(url, { method, headers, signal });
    } catch (error) {
      if (isAbortError(error)) {
        throw errors.integracao("INT_TIMEOUT");
      }
      throw errors.integracao("INT_PROVEDOR_INDISPONIVEL");
    }
  }

  async function readBody(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch (error) {
      if (isAbortError(error)) {
        throw errors.integracao("INT_TIMEOUT");
      }
      throw errors.integracao("INT_PROVEDOR_INDISPONIVEL");
    }
  }

  async function request(url: string, requestOptions: HttpRequestOptions = {}): Promise<HttpResponse> {
    const method = requestOptions.method ?? "GET";
    const headers = requestOptions.headers === undefined ? undefined : { ...requestOptions.headers };

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const signal = timeoutSignal(requestOptions.signal);
      const response = await fetchOnce(url, method, headers, signal);
      const body = await readBody(response);

      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        await sleepImpl(backoffMs * 2 ** attempt);
        continue;
      }

      if (response.status === 429) {
        throw errors.integracao("INT_LIMITE_EXCEDIDO");
      }

      if (response.status >= 500 && response.status <= 599) {
        throw errors.integracao("INT_PROVEDOR_INDISPONIVEL");
      }

      return { status: response.status, ok: response.ok, body };
    }

    // Inalcançável: o loop sempre retorna ou lança na última tentativa.
    throw errors.integracao("INT_PROVEDOR_INDISPONIVEL");
  }

  return {
    request,
    get(url: string, requestOptions?: Omit<HttpRequestOptions, "method">): Promise<HttpResponse> {
      return request(url, requestOptions);
    },
  };
}
