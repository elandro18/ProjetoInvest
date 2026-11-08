import { describe, expect, it } from "vitest";

import { sanitizeCallbackUrl } from "./navigation";

describe("sanitizeCallbackUrl", () => {
  it("aceita caminho interno com query", () => {
    expect(sanitizeCallbackUrl("/conta?aba=dados")).toBe("/conta?aba=dados");
  });

  it("rejeita URL absoluta e protocol-relative (open redirect)", () => {
    expect(sanitizeCallbackUrl("https://malicioso.example")).toBeNull();
    expect(sanitizeCallbackUrl("//malicioso.example")).toBeNull();
    expect(sanitizeCallbackUrl("/\\malicioso.example")).toBeNull();
  });

  it("normaliza caminho com ..", () => {
    expect(sanitizeCallbackUrl("/conta/../login")).toBe("/login");
  });

  it("devolve null para ausência", () => {
    expect(sanitizeCallbackUrl(null)).toBeNull();
    expect(sanitizeCallbackUrl("   ")).toBeNull();
  });
});
