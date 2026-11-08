import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiRequest,
  errosPorCampo,
  mensagemDeErro,
  MENSAGEM_ERRO_GENERICO,
} from "./api-client";

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("devolve o corpo tipado em sucesso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaJson({ message: "ok" })));

    const resultado = await apiRequest<{ message: string }>("/api/teste");

    expect(resultado).toEqual({ ok: true, status: 200, data: { message: "ok" } });
  });

  it("lê o envelope de erro sem lançar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaJson(
          {
            error: {
              code: "VALIDACAO",
              message: "Um ou mais campos são inválidos.",
              details: { errors: [{ field: "email", message: "Informe um e-mail válido." }] },
            },
          },
          422,
        ),
      ),
    );

    const resultado = await apiRequest("/api/teste", { method: "POST", body: { email: "x" } });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) {
      throw new Error("esperava falha");
    }
    expect(resultado.status).toBe(422);
    expect(resultado.error.code).toBe("VALIDACAO");
    expect(errosPorCampo(resultado.error)).toEqual({ email: "Informe um e-mail válido." });
  });

  it("trata 204 como sucesso sem corpo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const resultado = await apiRequest<undefined>("/api/logout", { method: "POST" });

    expect(resultado).toEqual({ ok: true, status: 204, data: undefined });
  });

  it("transforma falha de rede em erro recuperável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("falhou")));

    const resultado = await apiRequest("/api/teste");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) {
      throw new Error("esperava falha");
    }
    expect(resultado.status).toBe(0);
    expect(resultado.error.code).toBe("ERRO_REDE");
  });

  it("não expõe detalhe interno quando a resposta de erro não é JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>erro</html>", { status: 500 })),
    );

    const resultado = await apiRequest("/api/teste");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) {
      throw new Error("esperava falha");
    }
    expect(resultado.error.message).toBe(MENSAGEM_ERRO_GENERICO);
  });
});

describe("mensagemDeErro", () => {
  it("inclui o tempo de espera em rate limit", () => {
    expect(
      mensagemDeErro({
        code: "RATE_LIMIT_EXCEDIDO",
        message: "Muitas tentativas.",
        details: { retryAfterSegundos: 30 },
      }),
    ).toBe("Muitas tentativas. Aguarde 30 s e tente novamente.");
  });
});
