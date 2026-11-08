import { describe, expect, it } from "vitest";

import { linkRedefinicaoSenha, linkVerificacao } from "./mailer";

describe("links de conta", () => {
  it("monta o link de verificação sem barra duplicada", () => {
    expect(linkVerificacao("https://app.exemplo/", "token-puro")).toBe(
      "https://app.exemplo/verificar-email?token=token-puro",
    );
    expect(linkVerificacao("https://app.exemplo///", "token-puro")).toBe(
      "https://app.exemplo/verificar-email?token=token-puro",
    );
  });

  it("monta o link de redefinição sem barra duplicada", () => {
    expect(linkRedefinicaoSenha("https://app.exemplo", "token-puro")).toBe(
      "https://app.exemplo/redefinir-senha?token=token-puro",
    );
  });

  it("codifica o token no parâmetro de consulta", () => {
    expect(linkVerificacao("https://app.exemplo", "a/b+c=d")).toBe(
      "https://app.exemplo/verificar-email?token=a%2Fb%2Bc%3Dd",
    );
    expect(linkRedefinicaoSenha("https://app.exemplo", "a b")).toBe(
      "https://app.exemplo/redefinir-senha?token=a%20b",
    );
  });
});
