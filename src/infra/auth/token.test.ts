import { describe, expect, it } from "vitest";

import { gerarToken, hashToken, tokensIguais } from "./token";

const HASH_SHA256 = /^[0-9a-f]{64}$/;

describe("gerarToken", () => {
  it("gera 32 bytes em base64url e o hash SHA-256 correspondente", () => {
    const { token, hash } = gerarToken();

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toMatch(HASH_SHA256);
    expect(hash).toBe(hashToken(token));
  });

  it("nunca repete o valor puro em 500 emissões", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => gerarToken().token));

    expect(tokens.size).toBe(500);
  });

  it("não expõe o valor puro dentro do hash", () => {
    const { token, hash } = gerarToken();

    expect(hash).not.toContain(token);
  });
});

describe("hashToken", () => {
  it("é determinístico", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("tokensIguais", () => {
  it("compara hashes em tempo constante", () => {
    const { hash } = gerarToken();

    expect(tokensIguais(hash, hash)).toBe(true);
    expect(tokensIguais(hash, hashToken("outro-token"))).toBe(false);
    expect(tokensIguais(hash, `${hash}0`)).toBe(false);
    expect(tokensIguais("", hash)).toBe(false);
  });
});
