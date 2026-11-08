import { describe, expect, it } from "vitest";

import {
  EmailJaCadastradoError,
  STATUS_CONTA,
  TIPO_ACEITE_LEGAL,
  TIPO_TOKEN_CONTA,
} from "./repositorio";

/**
 * O port de persistência só tem comportamento próprio nos vocabulários
 * fechados e no erro de unicidade; o restante é contrato de tipos.
 */
describe("repositorio de conta", () => {
  it("expõe os vocabulários do schema", () => {
    expect(STATUS_CONTA).toEqual(["PENDENTE_VERIFICACAO", "ATIVA", "SUSPENSA", "EXCLUIDA"]);
    expect(TIPO_TOKEN_CONTA).toEqual(["VERIFICACAO_EMAIL", "REDEFINICAO_SENHA"]);
    expect(TIPO_ACEITE_LEGAL).toEqual(["TERMOS_USO", "POLITICA_PRIVACIDADE"]);
  });

  it("EmailJaCadastradoError tem nome e mensagem estáveis para o mapeamento da borda", () => {
    const erro = new EmailJaCadastradoError();

    expect(erro).toBeInstanceOf(Error);
    expect(erro.name).toBe("EmailJaCadastradoError");
    expect(erro.message).toBe("E-mail já cadastrado.");
  });
});
