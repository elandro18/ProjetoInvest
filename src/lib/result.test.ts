import { describe, expect, it } from "vitest";

import { err, isErr, isOk, ok, unwrapOr } from "./result";
import { AppError } from "./errors";

describe("Result", () => {
  it("constrói sucesso com ok()", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(result.ok).toBe(true);
  });

  it("constrói falha com err()", () => {
    const error = new AppError("VALIDACAO");
    const result = err(error);

    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, error });
  });

  it("reconhece sucesso com isOk/isErr", () => {
    const result = ok("valor");

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("reconhece falha com isOk/isErr", () => {
    const result = err(new AppError("ERRO_INTERNO"));

    expect(isOk(result)).toBe(false);
    expect(isErr(result)).toBe(true);
  });

  it("devolve o valor em caso de sucesso", () => {
    expect(unwrapOr(ok("real"), "fallback")).toBe("real");
  });

  it("devolve o fallback em caso de erro", () => {
    expect(unwrapOr(err(new AppError("VALIDACAO")), "fallback")).toBe("fallback");
  });
});
