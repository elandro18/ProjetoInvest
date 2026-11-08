import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "../../lib/errors";
import { parseJsonBody, readJsonBody, toValidationError, validate } from "./validation";

const cadastroSchema = z.object({
  nome: z.string().min(3),
  idade: z.number().int().positive(),
});

function jsonRequest(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/api/teste", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("toValidationError", () => {
  it("produz um item por campo, na ordem das issues", () => {
    const parsed = cadastroSchema.safeParse({ nome: "ab", idade: -1 });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const error = toValidationError(parsed.error);

      expect(error.code).toBe("VALIDACAO");
      expect(error.status).toBe(422);
      expect(error.details).toEqual({
        errors: [
          { field: "nome", message: expect.any(String) },
          { field: "idade", message: expect.any(String) },
        ],
      });
    }
  });

  it("deduplica múltiplas issues do mesmo campo", () => {
    const schema = z.object({ codigo: z.string().min(5).regex(/^\d+$/) });
    const parsed = schema.safeParse({ codigo: "ab" });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const error = toValidationError(parsed.error);
      const errors = error.details?.errors as { field: string }[];

      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe("codigo");
    }
  });

  it("usa o caminho completo para campos aninhados", () => {
    const schema = z.object({ usuario: z.object({ email: z.string().email() }) });
    const parsed = schema.safeParse({ usuario: { email: "invalido" } });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const errors = toValidationError(parsed.error).details?.errors as { field: string }[];

      expect(errors[0].field).toBe("usuario.email");
    }
  });

  it("rotula issue sem caminho como _root", () => {
    const schema = z.string().min(3);
    const parsed = schema.safeParse("ab");
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const errors = toValidationError(parsed.error).details?.errors as { field: string }[];

      expect(errors[0].field).toBe("_root");
    }
  });
});

describe("validate", () => {
  it("devolve o dado tipado quando válido", () => {
    const data = validate(cadastroSchema, { nome: "Ana", idade: 30 });

    expect(data).toEqual({ nome: "Ana", idade: 30 });
  });

  it("lança AppError VALIDACAO quando inválido", () => {
    try {
      validate(cadastroSchema, { nome: "A", idade: 0 });
      expect.unreachable("deveria lançar");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe("VALIDACAO");
      expect((error as AppError).status).toBe(422);
    }
  });
});

describe("readJsonBody", () => {
  it("lê corpo JSON válido", async () => {
    await expect(readJsonBody(jsonRequest('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it("aceita content-type com charset", async () => {
    await expect(
      readJsonBody(jsonRequest('{"a":2}', "application/json; charset=utf-8")),
    ).resolves.toEqual({ a: 2 });
  });

  it("rejeita content-type diferente de JSON com 400", async () => {
    try {
      await readJsonBody(jsonRequest('{"a":1}', "text/plain"));
      expect.unreachable("deveria lançar");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe("REQUISICAO_MALFORMADA");
      expect((error as AppError).status).toBe(400);
      expect((error as AppError).details).toEqual({ motivo: "content-type" });
    }
  });

  it("rejeita JSON malformado com 400", async () => {
    try {
      await readJsonBody(jsonRequest("{nao é json"));
      expect.unreachable("deveria lançar");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe("REQUISICAO_MALFORMADA");
      expect((error as AppError).status).toBe(400);
    }
  });

  it("rejeita corpo vazio com 400", async () => {
    try {
      await readJsonBody(jsonRequest(""));
      expect.unreachable("deveria lançar");
    } catch (error) {
      expect((error as AppError).code).toBe("REQUISICAO_MALFORMADA");
    }
  });
});

describe("parseJsonBody", () => {
  it("lê e valida em uma etapa", async () => {
    await expect(
      parseJsonBody(jsonRequest('{"nome":"Ana","idade":30}'), cadastroSchema),
    ).resolves.toEqual({ nome: "Ana", idade: 30 });
  });

  it("propaga 422 quando o corpo não satisfaz o schema", async () => {
    await expect(
      parseJsonBody(jsonRequest('{"nome":"A"}'), cadastroSchema),
    ).rejects.toMatchObject({ code: "VALIDACAO", status: 422 });
  });
});
