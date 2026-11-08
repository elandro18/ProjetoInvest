import { describe, expect, it } from "vitest";

import { hashSenha, verificarSenha } from "./password";

const SENHA = "senha-de-teste-123";

describe("hashSenha", () => {
  it("produz hash Argon2id diferente da senha em claro", async () => {
    const hash = await hashSenha(SENHA);

    expect(hash).not.toBe(SENHA);
    expect(hash).not.toContain(SENHA);
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("gera hashes distintos para a mesma senha (salt por hash)", async () => {
    const primeiro = await hashSenha(SENHA);
    const segundo = await hashSenha(SENHA);

    expect(primeiro).not.toBe(segundo);
  });
});

describe("verificarSenha", () => {
  it("aceita a senha correta", async () => {
    const hash = await hashSenha(SENHA);

    await expect(verificarSenha(hash, SENHA)).resolves.toBe(true);
  });

  it("recusa senha incorreta e hash inválido sem lançar", async () => {
    const hash = await hashSenha(SENHA);

    await expect(verificarSenha(hash, "outra-senha-123")).resolves.toBe(false);
    await expect(verificarSenha("texto-que-nao-e-hash", SENHA)).resolves.toBe(false);
  });
});
