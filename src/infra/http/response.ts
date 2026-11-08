import { AppError, type AppErrorDetails, type AppErrorCode } from "../../lib/errors";

/**
 * Mapeamento erro de aplicação → HTTP (ERROR_CATALOG.md §1).
 *
 * Envelope: `{ "error": { "code", "message", "details"? } }`.
 * `details.traceId` só existe em 5xx, para o titular reportar sem que o
 * interno seja exposto.
 */

export interface ErrorEnvelope {
  error: {
    code: AppErrorCode;
    message: string;
    details?: AppErrorDetails;
  };
}

export interface ErrorHttpResult {
  status: number;
  body: ErrorEnvelope;
}

export const REQUEST_ID_HEADER = "x-request-id";

export function toErrorBody(error: unknown, traceId: string): ErrorHttpResult {
  const appError = AppError.isAppError(error)
    ? error
    : new AppError("ERRO_INTERNO", { cause: error });

  const isServerError = appError.status >= 500;
  const details = isServerError ? { ...(appError.details ?? {}), traceId } : appError.details;

  return {
    status: appError.status,
    body: {
      error:
        details === undefined
          ? { code: appError.code, message: appError.message }
          : { code: appError.code, message: appError.message, details },
    },
  };
}

export function withRequestIdHeader(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

export function toHttpResponse(error: unknown, traceId: string): Response {
  const { status, body } = toErrorBody(error, traceId);
  return jsonResponse(body, status, traceId);
}
