import { describe, expect, it } from "vitest";

import {
  emailValido,
  validarConfirmacao,
  validarEmail,
  validarNome,
  validarNovaSenha,
  validarSenhaInformada,
} from "./form-validation";

describe("validações de forma", () => {
  it("aceita e-mail válido e recusa formatos incompletos", () => {
    expect(emailValido("titular@exemplo.com")).toBe(true);
    expect(emailValido("titular@exemplo")).toBe(false);
    expect(emailValido("")).toBe(false);
    expect(validarEmail("")).toBe("Informe seu e-mail.");
    expect(validarEmail("sem-arroba")).toBe("Informe um e-mail válido.");
  });

  it("valida o nome entre 3 e 120 caracteres", () => {
    expect(validarNome("")).toBe("Informe seu nome.");
    expect(validarNome("Jo")).toBe("O nome deve ter pelo menos 3 caracteres.");
    expect(validarNome("João")).toBeNull();
  });

  it("exige senha informada e mínima de 10 caracteres", () => {
    expect(validarSenhaInformada("")).toBe("Informe sua senha.");
    expect(validarSenhaInformada("qualquer")).toBeNull();
    expect(validarNovaSenha("curta")).toBe("A senha deve ter pelo menos 10 caracteres.");
    expect(validarNovaSenha("SenhaForte123!")).toBeNull();
  });

  it("confere a confirmação de senha", () => {
    expect(validarConfirmacao("SenhaForte123!", "")).toBe("Confirme a senha.");
    expect(validarConfirmacao("SenhaForte123!", "outra")).toBe("As senhas não coincidem.");
    expect(validarConfirmacao("SenhaForte123!", "SenhaForte123!")).toBeNull();
  });
});
