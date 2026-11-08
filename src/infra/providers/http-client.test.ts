import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../lib/errors";
import {
  DEFAULT_BACKOFF_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  createHttpClient,
} from "./http-client";

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

describe("constantes padrão", () => {
  it("timeout de 5s e no máximo 2 retries", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(5_000);
    expect(DEFAULT_MAX_RETRIES).toBe(2);
    expect(DEFAULT_BACKOFF_MS).toBe(100);
  });
});

describe("createHttpClient — sucesso", () => {
  it("devolve status, ok e corpo", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse('{"ok":true}', 200));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    const result = await client.get("https://exemplo.test/dados");

    expect(result).toEqual({ status: 200, ok: true, body: '{"ok":true}' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("envia método e headers informados", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse("", 201));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await client.request("https://exemplo.test/dados", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ authorization: "Bearer token" });
  });

  it("usa GET por padrão", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse("", 200));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await client.request("https://exemplo.test/dados");

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect(init.headers).toBeUndefined();
  });
});

describe("createHttpClient — retry", () => {
  it("repete 503 e devolve 200 na segunda tentativa", async () => {
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse("", 503))
      .mockResolvedValueOnce(jsonResponse('{"ok":true}', 200));
    const sleepImpl = vi.fn(async () => {});
    const client = createHttpClient({ fetchImpl, sleepImpl, backoffMs: 25 });

    const result = await client.get("https://exemplo.test/dados");

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(25);
  });

  it("aplica backoff exponencial entre tentativas", async () => {
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse("", 429))
      .mockResolvedValueOnce(jsonResponse("", 500))
      .mockResolvedValueOnce(jsonResponse("", 200));
    const sleepImpl = vi.fn(async () => {});
    const client = createHttpClient({ fetchImpl, sleepImpl, backoffMs: 10 });

    await client.get("https://exemplo.test/dados");

    expect(sleepImpl).toHaveBeenNthCalledWith(1, 10);
    expect(sleepImpl).toHaveBeenNthCalledWith(2, 20);
  });

  it("lança INT_LIMITE_EXCEDIDO quando 429 persiste", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse("", 429));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_LIMITE_EXCEDIDO",
      status: 429,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(DEFAULT_MAX_RETRIES + 1);
  });

  it("lança INT_PROVEDOR_INDISPONIVEL quando 5xx persiste", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse("", 502));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_PROVEDOR_INDISPONIVEL",
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(DEFAULT_MAX_RETRIES + 1);
  });

  it("não repete 4xx comum", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse("nao encontrado", 404));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    const result = await client.get("https://exemplo.test/dados");

    expect(result).toEqual({ status: 404, ok: false, body: "nao encontrado" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("respeita maxRetries configurado", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse("", 503));
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {}, maxRetries: 0 });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_PROVEDOR_INDISPONIVEL",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("createHttpClient — falhas de transporte", () => {
  it("converte erro de abort/timeout em INT_TIMEOUT sem retry", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_TIMEOUT",
      status: 504,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("converte falha de rede em INT_PROVEDOR_INDISPONIVEL", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_PROVEDOR_INDISPONIVEL",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("converte falha ao ler o corpo (abort) em INT_TIMEOUT", async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        status: 200,
        ok: true,
        text: async () => {
          throw new DOMException("abortado", "AbortError");
        },
      } as unknown as Response;
    });
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_TIMEOUT",
    });
  });

  it("converte falha ao ler o corpo (genérica) em INT_PROVEDOR_INDISPONIVEL", async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        status: 200,
        ok: true,
        text: async () => {
          throw new Error("corpo quebrado");
        },
      } as unknown as Response;
    });
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toMatchObject({
      code: "INT_PROVEDOR_INDISPONIVEL",
    });
  });

  it("propaga o sinal abortado do chamador para o fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    let sinalRecebido: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      sinalRecebido = init?.signal ?? undefined;
      return jsonResponse("", 200);
    });
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await client.get("https://exemplo.test/dados", { signal: controller.signal });

    expect(sinalRecebido?.aborted).toBe(true);
  });

  it("mantém o tipo AppError nas falhas", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createHttpClient({ fetchImpl, sleepImpl: async () => {} });

    await expect(client.get("https://exemplo.test/dados")).rejects.toBeInstanceOf(AppError);
  });
});
