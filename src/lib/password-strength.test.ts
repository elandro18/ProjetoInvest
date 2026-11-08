import { describe, expect, it } from "vitest";

import { avaliarForcaSenha } from "./password-strength";

describe("avaliarForcaSenha", () => {
  it("informa que falta digitar quando está vazia", () => {
    expect(avaliarForcaSenha("")).toMatchObject({ pontuacao: 0, rotulo: "Digite uma senha" });
  });

  it("pontua curta e simples como muito fraca", () => {
    const forca = avaliarForcaSenha("abcdefgh");
    expect(forca.pontuacao).toBe(0);
    expect(forca.rotulo).toBe("Muito fraca");
    expect(forca.dicas).toContain("Use pelo menos 10 caracteres");
  });

  it("reconhece senha longa com variedade como forte", () => {
    expect(avaliarForcaSenha("SenhaForte123!")).toMatchObject({
      pontuacao: 4,
      rotulo: "Forte",
      dicas: [],
    });
  });

  it("lista dicas para o que falta", () => {
    const forca = avaliarForcaSenha("senhasenha1");
    expect(forca.dicas).toContain("Misture letras maiúsculas e minúsculas");
    expect(forca.dicas).toContain("Inclua um símbolo");
  });
});
