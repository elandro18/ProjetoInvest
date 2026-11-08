import { AppError, type AppErrorCode } from "../../lib/errors";
import { logHttpRequest } from "../logging/logger";
import { toHttpResponse, withRequestIdHeader } from "./response";

/**
 * Wrapper de Route Handler (Next.js App Router).
 *
 * Responsabilidades — e somente elas:
 * 1. gera um `requestId` imprevisível por requisição (UUID v4);
 * 2. devolve o `requestId` em `x-request-id` e o propaga ao handler;
 * 3. converte `AppError` e exceções não tratadas no envelope padrão,
 *    sempre com `details.traceId` em 5xx;
 * 4. mede a duração e registra um único log estruturado (sem payload).
 *
 * O `requestId` enviado pelo cliente nunca é reaproveitado: seria um valor
 * controlado pelo usuário e correlacionável entre titulares.
 */

export interface RouteContext {
  requestId: string;
  [key: string]: unknown;
}

export type RouteHandler = (request: Request, context: RouteContext) => Response | Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requestRoute(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "desconhecida";
  }
}

export function withRoute(handler: RouteHandler): (request: Request, context?: unknown) => Promise<Response> {
  return async (request: Request, context?: unknown): Promise<Response> => {
    const requestId = globalThis.crypto.randomUUID();
    const route = requestRoute(request);
    const startedAt = performance.now();

    try {
      const response = await handler(request, {
        ...(isRecord(context) ? context : {}),
        requestId,
      });

      logHttpRequest({
        requestId,
        method: request.method,
        route,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });

      return withRequestIdHeader(response, requestId);
    } catch (error) {
      const response = toHttpResponse(error, requestId);
      const errorCode: AppErrorCode = AppError.isAppError(error) ? error.code : "ERRO_INTERNO";

      logHttpRequest({
        requestId,
        method: request.method,
        route,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        errorCode,
      });

      return response;
    }
  };
}
