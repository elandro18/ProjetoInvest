import { describe, expect, it } from "vitest";

import { AppError } from "../../lib/errors";
import {
  REQUEST_ID_HEADER,
  jsonResponse,
  toErrorBody,
  toHttpResponse,
  withRequestIdHeader,
} from "./response";

describe("toErrorBody", () => {
  it("mapeia erro de validação para 422 sem traceId", () => {
    const error = new AppError("VALIDACAO", {
      details: { errors: [{ field: "email", message: "inválido" }] },
    });

    const result = toErrorBody(error, "trace-1");

    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe("VALIDACAO");
    expect(result.body.error.details).toEqual({
      errors: [{ field: "email", message: "inválido" }],
    });
    expect(result.body.error.details).not.toHaveProperty("traceId");
  });

  it("mapeia 4xx sem details para envelope mínimo", () => {
    const result = toErrorBody(new AppError("RECURSO_NAO_ENCONTRADO"), "trace-1");

    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      error: {
        code: "RECURSO_NAO_ENCONTRADO",
        message: "Recurso não encontrado.",
      },
    });
  });

  it("adiciona traceId em erro 5xx", () => {
    const result = toErrorBody(new AppError("ERRO_INTERNO"), "trace-abc");

    expect(result.status).toBe(500);
    expect(result.body.error.details).toEqual({ traceId: "trace-abc" });
  });

  it("preserva details existentes e acrescenta traceId em 5xx", () => {
    const result = toErrorBody(
      new AppError("INT_RESPOSTA_INVALIDA", { details: { provedor: "cvm" } }),
      "trace-abc",
    );

    expect(result.status).toBe(502);
    expect(result.body.error.details).toEqual({ provedor: "cvm", traceId: "trace-abc" });
  });

  it("converte exceção desconhecida em ERRO_INTERNO 500 com traceId", () => {
    const result = toErrorBody(new Error("falha crua"), "trace-xyz");

    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("ERRO_INTERNO");
    expect(result.body.error.message).not.toContain("falha crua");
    expect(result.body.error.details).toEqual({ traceId: "trace-xyz" });
  });

  it("trata valor lançado que não é Error", () => {
    const result = toErrorBody("string lançada", "trace-1");

    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("ERRO_INTERNO");
  });
});

describe("withRequestIdHeader", () => {
  it("acrescenta x-request-id preservando status, statusText, headers e corpo", async () => {
    const original = new Response("corpo", {
      status: 201,
      statusText: "Created",
      headers: { "content-type": "text/plain" },
    });

    const wrapped = withRequestIdHeader(original, "req-123");

    expect(wrapped.status).toBe(201);
    expect(wrapped.statusText).toBe("Created");
    expect(wrapped.headers.get(REQUEST_ID_HEADER)).toBe("req-123");
    expect(wrapped.headers.get("content-type")).toBe("text/plain");
    await expect(wrapped.text()).resolves.toBe("corpo");
  });

  it("sobrescreve um x-request-id enviado pelo upstream", () => {
    const original = new Response("", { headers: { [REQUEST_ID_HEADER]: "forjado" } });

    const wrapped = withRequestIdHeader(original, "req-real");

    expect(wrapped.headers.get(REQUEST_ID_HEADER)).toBe("req-real");
  });
});

describe("jsonResponse", () => {
  it("serializa JSON com content-type e requestId", async () => {
    const response = jsonResponse({ status: "ok" }, 200, "req-1");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-1");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("toHttpResponse", () => {
  it("combina status, envelope e header", async () => {
    const response = toHttpResponse(new AppError("BANCO_INDISPONIVEL"), "trace-9");

    expect(response.status).toBe(503);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("trace-9");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BANCO_INDISPONIVEL",
        message: "Serviço temporariamente indisponível.",
        details: { traceId: "trace-9" },
      },
    });
  });
});
