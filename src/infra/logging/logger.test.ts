import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logHttpRequest, logger, sanitize } from "./logger";

interface LogRecord {
  level: string;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

function parse(call: unknown[]): LogRecord {
  return JSON.parse(String(call[0])) as LogRecord;
}

describe("sanitize", () => {
  it("mascara campos sensíveis", () => {
    const sanitized = sanitize({
      senha: "segredo",
      novaSenha: "outro",
      token: "token-123",
      accessToken: "access",
      refreshToken: "refresh",
      authorization: "Bearer abc",
      apiKey: "chave",
      apiSecret: "segredo2",
      secret: "segredo3",
      cookie: "cookie",
      "api-key": "chave2",
      confirmarSenha: "igual",
    }) as Record<string, string>;

    expect(Object.values(sanitized)).toEqual(Array(12).fill("[REDACTED]"));
  });

  it("omite chaves de payload financeiro, inclusive com acento", () => {
    const sanitized = sanitize({
      valor: "100.00",
      valorTotal: "100.00",
      valorUnitario: "10.00",
      preco: "10.00",
      precoMedio: "10.00",
      "preçoMédio": "10.00",
      quantidade: 10,
      saldo: "100.00",
      patrimonio: "100.00",
      payload: { qualquer: "coisa" },
      body: "corpo",
      requestBody: "corpo",
    }) as Record<string, string>;

    expect(Object.values(sanitized)).toEqual(Array(12).fill("[OMITIDO]"));
  });

  it("mascara em objetos aninhados", () => {
    const sanitized = sanitize({ usuario: { senha: "x", nome: "Ana" } }) as {
      usuario: Record<string, string>;
    };

    expect(sanitized.usuario).toEqual({ senha: "[REDACTED]", nome: "Ana" });
  });

  it("preserva null, undefined, número e booleano", () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
    expect(sanitize(10)).toBe(10);
    expect(sanitize(false)).toBe(false);
  });

  it("trunca strings acima de 300 caracteres", () => {
    const sanitized = sanitize("a".repeat(301)) as string;

    expect(sanitized.endsWith("…[truncado]")).toBe(true);
    expect(sanitized.startsWith("a".repeat(300))).toBe(true);
  });

  it("não trunca string de exatamente 300 caracteres", () => {
    const original = "a".repeat(300);

    expect(sanitize(original)).toBe(original);
  });

  it("converte bigint, symbol e function em string", () => {
    expect(sanitize(BigInt(10))).toBe("10");
    expect(sanitize(Symbol("marca"))).toBe("Symbol(marca)");
    expect(sanitize(function nomeada() {})).toContain("function");
  });

  it("serializa Date como ISO", () => {
    expect(sanitize(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z");
  });

  it("não serializa a mensagem de Error", () => {
    expect(sanitize(new Error("mensagem sensível"))).toEqual({ name: "Error" });
  });

  it("trunca objetos além da profundidade máxima", () => {
    const sanitized = sanitize({ a: { b: { c: { d: { e: 1 } } } } });

    expect(sanitized).toEqual({ a: { b: { c: { d: "[TRUNCADO]" } } } });
  });

  it("limita arrays a 20 itens e sinaliza o excedente", () => {
    const sanitized = sanitize(Array.from({ length: 21 }, (_, index) => index)) as unknown[];

    expect(sanitized).toHaveLength(21);
    expect(sanitized.slice(0, 20)).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(sanitized[20]).toBe("[+1 itens]");
  });
});

describe("logger", () => {
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

  it("emite uma linha JSON por evento de info", () => {
    logger.info("teste.info", { requestId: "req-1" });

    expect(info).toHaveBeenCalledTimes(1);
    const log = parse(info.mock.calls[0]);
    expect(log.level).toBe("info");
    expect(log.event).toBe("teste.info");
    expect(log.requestId).toBe("req-1");
    expect(Number.isNaN(Date.parse(log.timestamp))).toBe(false);
  });

  it("usa console.warn para warn e console.error para error", () => {
    logger.warn("teste.warn");
    logger.error("teste.error");

    expect(parse(warn.mock.calls[0]).level).toBe("warn");
    expect(parse(error.mock.calls[0]).level).toBe("error");
  });

  it("mascara segredos e dados financeiros antes de emitir", () => {
    logger.info("teste.financeiro", {
      requestId: "req-1",
      senha: "senha-real",
      valorTotal: "1000.00",
      usuario: { token: "token-real" },
    });

    const linha = String(info.mock.calls[0][0]);
    expect(linha).not.toContain("senha-real");
    expect(linha).not.toContain("token-real");
    expect(linha).not.toContain("1000.00");
    expect(linha).toContain("[REDACTED]");
    expect(linha).toContain("[OMITIDO]");
  });

  it("não explode com campos vazios", () => {
    logger.info("teste.vazio");

    expect(parse(info.mock.calls[0])).toMatchObject({ event: "teste.vazio", level: "info" });
  });
});

describe("logHttpRequest", () => {
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

  it("usa nível info para 2xx/3xx", () => {
    logHttpRequest({
      requestId: "req-1",
      method: "GET",
      route: "/api/health",
      status: 200,
      durationMs: 3,
    });

    expect(parse(info.mock.calls[0])).toMatchObject({
      level: "info",
      event: "http.request",
      route: "/api/health",
      status: 200,
      durationMs: 3,
    });
  });

  it("usa nível warn para 4xx", () => {
    logHttpRequest({
      requestId: "req-2",
      method: "POST",
      route: "/api/x",
      status: 404,
      durationMs: 1,
    });

    expect(parse(warn.mock.calls[0])).toMatchObject({ level: "warn", status: 404 });
  });

  it("usa nível error para 5xx e inclui errorCode", () => {
    logHttpRequest({
      requestId: "req-3",
      method: "GET",
      route: "/api/x",
      status: 500,
      durationMs: 2,
      errorCode: "ERRO_INTERNO",
    });

    expect(parse(error.mock.calls[0])).toMatchObject({
      level: "error",
      status: 500,
      errorCode: "ERRO_INTERNO",
    });
  });
});
