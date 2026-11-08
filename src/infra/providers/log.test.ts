import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../lib/errors";
import type { DadoProveniente } from "../../modules/pesquisa/provedor";
import {
  MENSAGEM_MAX_LENGTH,
  createPrismaLogIntegracaoStore,
  executarComLog,
  sanitizarMensagem,
  statusPorErro,
  type LogIntegracaoStore,
} from "./log";

function dado<T>(valor: T, dataReferencia = "2026-05-06"): DadoProveniente<T> {
  return {
    valor,
    fonte: "stub",
    provedorId: "stub",
    dataReferencia,
    coletadoEm: "2026-05-06T10:00:00.000Z",
    statusDado: "ESTIMADO",
  };
}

function prismaComCreate(create: ReturnType<typeof vi.fn>): PrismaClient {
  return { logIntegracao: { create } } as unknown as PrismaClient;
}

describe("sanitizarMensagem", () => {
  it("devolve null para ausência de mensagem", () => {
    expect(sanitizarMensagem()).toBeNull();
    expect(sanitizarMensagem(null)).toBeNull();
  });

  it("colapsa quebras de linha e espaços repetidos", () => {
    expect(sanitizarMensagem("linha1\nlinha2\r\nlinha3")).toBe("linha1 linha2 linha3");
    expect(sanitizarMensagem("a    b")).toBe("a b");
  });

  it("mascara Bearer token", () => {
    const resultado = sanitizarMensagem("Authorization: Bearer eyJhbGciOi.abc.def");

    expect(resultado).not.toContain("eyJhbGciOi.abc.def");
    expect(resultado).toContain("[REDACTED]");
  });

  it("mascara token, api-key, senha e segredo em pares chave=valor", () => {
    const resultado = sanitizarMensagem(
      "token=abc123 api-key: 'chave-secreta' senha: hunter2 segredo=xyz",
    );

    expect(resultado).not.toContain("abc123");
    expect(resultado).not.toContain("chave-secreta");
    expect(resultado).not.toContain("hunter2");
    expect(resultado).not.toContain("xyz");
    expect(resultado?.match(/\[REDACTED\]/g)).toHaveLength(4);
  });

  it("omite valores financeiros", () => {
    const resultado = sanitizarMensagem("valor=100.00 preco:10.00 saldo=500 quantidade=10");

    expect(resultado).not.toContain("100.00");
    expect(resultado).not.toContain("10.00");
    expect(resultado).not.toContain("500");
    expect(resultado?.match(/\[OMITIDO\]/g)).toHaveLength(4);
  });

  it("trunca mensagem acima do limite da coluna", () => {
    const resultado = sanitizarMensagem("a".repeat(MENSAGEM_MAX_LENGTH + 200));

    expect(resultado).toHaveLength(MENSAGEM_MAX_LENGTH);
    expect(resultado?.endsWith("…")).toBe(true);
  });

  it("não trunca mensagem dentro do limite", () => {
    const mensagem = "a".repeat(MENSAGEM_MAX_LENGTH);

    expect(sanitizarMensagem(mensagem)).toBe(mensagem);
  });

  it("devolve string vazia para entrada vazia", () => {
    expect(sanitizarMensagem("   ")).toBe("");
  });
});

describe("statusPorErro", () => {
  it.each([
    ["INT_TIMEOUT", "TIMEOUT"],
    ["INT_LIMITE_EXCEDIDO", "LIMITE"],
    ["INT_RESPOSTA_INVALIDA", "DADOS_INCOMPLETOS"],
    ["INT_DADOS_INCOMPLETOS", "DADOS_INCOMPLETOS"],
    ["ERRO_INTERNO", "ERRO"],
    ["INT_PROVEDOR_INDISPONIVEL", "ERRO"],
  ] as const)("mapeia %s para %s", (codigo, esperado) => {
    expect(statusPorErro(new AppError(codigo))).toBe(esperado);
  });

  it("trata erro não tipado como ERRO", () => {
    expect(statusPorErro(new Error("comum"))).toBe("ERRO");
    expect(statusPorErro("string")).toBe("ERRO");
  });
});

describe("createPrismaLogIntegracaoStore", () => {
  it("persiste campos normalizados e mensagem sanitizada", async () => {
    const create = vi.fn(async () => ({}));
    const store = createPrismaLogIntegracaoStore(prismaComCreate(create));
    const dataConsulta = new Date("2026-01-01T00:00:00.000Z");

    await store.registrar({
      provedorId: "prov-1",
      operacao: "o".repeat(70),
      recurso: "r".repeat(130),
      status: "ERRO",
      httpStatus: 503,
      duracaoMs: 12.6,
      dataConsulta,
      dataReferencia: new Date("2026-01-01T00:00:00.000Z"),
      mensagem: "token=abc123 falhou",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        provedorId: "prov-1",
        operacao: "o".repeat(60),
        recurso: "r".repeat(120),
        status: "ERRO",
        httpStatus: 503,
        duracaoMs: 13,
        dataConsulta,
        dataReferencia: new Date("2026-01-01T00:00:00.000Z"),
        mensagem: "token=[REDACTED] falhou",
      },
    });
  });

  it("converte campos opcionais ausentes em null e duração negativa em zero", async () => {
    const create = vi.fn(async () => ({}));
    const store = createPrismaLogIntegracaoStore(prismaComCreate(create));

    await store.registrar({
      provedorId: "prov-1",
      operacao: "buscar",
      recurso: null,
      status: "SUCESSO",
      duracaoMs: -5,
      dataConsulta: new Date("2026-01-01T00:00:00.000Z"),
      mensagem: null,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        provedorId: "prov-1",
        operacao: "buscar",
        recurso: null,
        status: "SUCESSO",
        httpStatus: null,
        duracaoMs: 0,
        dataConsulta: new Date("2026-01-01T00:00:00.000Z"),
        dataReferencia: null,
        mensagem: null,
      },
    });
  });
});

describe("executarComLog — sucesso", () => {
  const clock = () => new Date("2026-01-02T00:00:00.000Z");

  it("registra SUCESSO com a data de referência do dado", async () => {
    const registrar = vi.fn(async () => {});
    const store: LogIntegracaoStore = { registrar };

    const resultado = await executarComLog({
      provedorId: "prov-1",
      operacao: "cotacao",
      store,
      clock,
      executar: async () => dado({ preco: "10.00" }),
    });

    expect(resultado.valor).toEqual({ preco: "10.00" });
    expect(registrar).toHaveBeenCalledWith({
      provedorId: "prov-1",
      operacao: "cotacao",
      recurso: undefined,
      status: "SUCESSO",
      duracaoMs: expect.any(Number),
      dataConsulta: new Date("2026-01-02T00:00:00.000Z"),
      dataReferencia: new Date("2026-05-06T00:00:00.000Z"),
    });
  });

  it("usa dataReferencia explícita quando informada", async () => {
    const registrar = vi.fn(async () => {});
    const dataReferencia = new Date("2026-02-02T00:00:00.000Z");

    await executarComLog({
      provedorId: "prov-1",
      operacao: "cotacao",
      recurso: "PETR4",
      dataReferencia,
      store: { registrar },
      clock,
      executar: async () => dado({}),
    });

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ dataReferencia, recurso: "PETR4" }),
    );
  });

  it("usa null quando a data de referência do dado é inválida", async () => {
    const registrar = vi.fn(async () => {});

    await executarComLog({
      provedorId: "prov-1",
      operacao: "cotacao",
      store: { registrar },
      clock,
      executar: async () => dado({}, "data-invalida"),
    });

    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ dataReferencia: null }));
  });
});

describe("executarComLog — falha", () => {
  const clock = () => new Date("2026-01-02T00:00:00.000Z");

  it("registra TIMEOUT e repropaga o erro original", async () => {
    const registrar = vi.fn(async () => {});
    const original = new AppError("INT_TIMEOUT");

    await expect(
      executarComLog({
        provedorId: "prov-1",
        operacao: "cotacao",
        store: { registrar },
        clock,
        executar: async () => {
          throw original;
        },
      }),
    ).rejects.toBe(original);

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "TIMEOUT",
        httpStatus: 504,
        mensagem: original.message,
        dataConsulta: new Date("2026-01-02T00:00:00.000Z"),
      }),
    );
  });

  it("registra ERRO para falha não tipada", async () => {
    const registrar = vi.fn(async () => {});

    await expect(
      executarComLog({
        provedorId: "prov-1",
        operacao: "cotacao",
        store: { registrar },
        clock,
        executar: async () => {
          throw new Error("falha crua");
        },
      }),
    ).rejects.toThrow("falha crua");

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ERRO",
        httpStatus: null,
        mensagem: "Falha inesperada na integração.",
      }),
    );
  });

  describe("quando o próprio log falha", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("registra o incidente e não mascara o erro original", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const original = new AppError("INT_PROVEDOR_INDISPONIVEL");
      const registrar = vi.fn(async () => {
        throw new Error("banco fora");
      });

      await expect(
        executarComLog({
          provedorId: "prov-1",
          operacao: "cotacao",
          store: { registrar },
          clock,
          executar: async () => {
            throw original;
          },
        }),
      ).rejects.toBe(original);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0][0])).toContain("integracao.log_falhou");
    });
  });
});
