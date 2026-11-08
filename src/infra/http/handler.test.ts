import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../lib/errors";
import { withRoute, type RouteContext } from "./handler";
import { REQUEST_ID_HEADER } from "./response";

interface LogLine {
  level: string;
  event: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode?: string;
  [key: string]: unknown;
}

function request(path = "/api/teste", method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

function parseLog(call: unknown[]): LogLine {
  return JSON.parse(String(call[0])) as LogLine;
}

describe("withRoute", () => {
  let info: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("propaga requestId ao handler e ao header x-request-id", async () => {
    let captured: RouteContext | undefined;

    const handler = withRoute(async (_request, context) => {
      captured = context;
      return new Response("ok", { status: 200 });
    });

    const response = await handler(request());

    expect(captured?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(captured?.requestId);
  });

  it("preserva o contexto recebido e acrescenta requestId", async () => {
    let captured: RouteContext | undefined;

    const handler = withRoute(async (_request, context) => {
      captured = context;
      return new Response("ok");
    });

    await handler(request(), { params: { id: "1" } });

    expect(captured?.params).toEqual({ id: "1" });
    expect(typeof captured?.requestId).toBe("string");
  });

  it("ignora contexto que não é objeto", async () => {
    let captured: RouteContext | undefined;

    const handler = withRoute(async (_request, context) => {
      captured = context;
      return new Response("ok");
    });

    await handler(request(), "texto");

    expect(captured).toEqual({ requestId: expect.any(String) });
  });

  it("registra um único log de sucesso sem payload", async () => {
    const handler = withRoute(async () => new Response("corpo-secreto", { status: 200 }));

    await handler(request("/api/teste"));

    expect(info).toHaveBeenCalledTimes(1);
    const log = parseLog(info.mock.calls[0]);
    expect(log).toMatchObject({
      level: "info",
      event: "http.request",
      method: "GET",
      route: "/api/teste",
      status: 200,
    });
    expect(log.requestId).toEqual(expect.any(String));
    expect(log.durationMs).toBeGreaterThanOrEqual(0);
    expect(log).not.toHaveProperty("body");
    expect(JSON.stringify(log)).not.toContain("corpo-secreto");
  });

  it("converte AppError em envelope 4xx, sem traceId", async () => {
    const handler = withRoute(async () => {
      throw new AppError("VALIDACAO", {
        details: { errors: [{ field: "nome", message: "obrigatório" }] },
      });
    });

    let response: Response | undefined;
    try {
      response = await handler(request());
    } catch {
      expect.unreachable("withRoute não deve propagar AppError");
    }

    expect(response?.status).toBe(422);
    expect(response?.headers.get(REQUEST_ID_HEADER)).toEqual(expect.any(String));
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: "VALIDACAO",
        message: "Um ou mais campos são inválidos.",
        details: { errors: [{ field: "nome", message: "obrigatório" }] },
      },
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(parseLog(warn.mock.calls[0])).toMatchObject({
      level: "warn",
      status: 422,
      errorCode: "VALIDACAO",
    });
  });

  it("converte exceção desconhecida em 500 com details.traceId igual ao requestId do log", async () => {
    const handler = withRoute(async () => {
      throw new Error("detalhe interno que não pode vazar");
    });

    const response = await handler(request("/api/falha"));
    const body = (await response.json()) as {
      error: { code: string; message: string; details: { traceId: string } };
    };
    const log = parseLog(error.mock.calls[0]);

    expect(response.status).toBe(500);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(body.error.details.traceId);
    expect(log.requestId).toBe(body.error.details.traceId);
    expect(log.errorCode).toBe("ERRO_INTERNO");
    expect(JSON.stringify(body)).not.toContain("detalhe interno que não pode vazar");
  });

  it("converte AppError 5xx em envelope com traceId e preserva details", async () => {
    const handler = withRoute(async () => {
      throw new AppError("BANCO_INDISPONIVEL", { details: { recurso: "carteira" } });
    });

    const response = await handler(request());
    const body = (await response.json()) as {
      error: { code: string; details: { recurso: string; traceId: string } };
    };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("BANCO_INDISPONIVEL");
    expect(body.error.details.recurso).toBe("carteira");
    expect(body.error.details.traceId).toBe(response.headers.get(REQUEST_ID_HEADER));
  });

  it("usa rota 'desconhecida' quando a URL não é parseável", async () => {
    const handler = withRoute(async () => new Response("ok"));
    const requestInvalida = { url: "url-invalida", method: "GET" } as unknown as Request;

    await handler(requestInvalida);

    expect(parseLog(info.mock.calls[0]).route).toBe("desconhecida");
  });

  it("entrega a mesma instância de Request ao handler", async () => {
    const entrada = request("/api/eco");
    let recebida: Request | undefined;

    const handler = withRoute(async (req) => {
      recebida = req;
      return new Response("ok");
    });

    await handler(entrada);

    expect(recebida).toBe(entrada);
  });
});
