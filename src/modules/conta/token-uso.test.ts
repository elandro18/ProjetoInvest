import { describe, expect, it } from "vitest";

import type { TokenPersistido } from "./repositorio";
import { classificarTokenDeUso } from "./token-uso";

/**
 * Matriz de decisão do token de uso único (RN-086).
 *
 * A ordem importa: estado da conta é avaliado antes de uso único e expiração,
 * porque uma conta suspensa não deve consumir nem reaproveitar token.
 */

const AGORA = new Date("2026-11-08T12:00:00.000Z");
const NO_FUTURO = new Date("2026-11-09T12:00:00.000Z");
const NO_PASSADO = new Date("2026-11-08T11:00:00.000Z");

function token(sobrescrita: Partial<TokenPersistido> = {}): TokenPersistido {
  return {
    id: "token-1",
    usuarioId: "usuario-1",
    tipo: "VERIFICACAO_EMAIL",
    expiraEm: NO_FUTURO,
    usadoEm: null,
    statusConta: "PENDENTE_VERIFICACAO",
    excluidoEm: null,
    ...sobrescrita,
  };
}

describe("classificarTokenDeUso", () => {
  it("aceita token válido de conta pendente", () => {
    expect(classificarTokenDeUso(token(), "VERIFICACAO_EMAIL", AGORA)).toBeNull();
  });

  it("rejeita token de outro tipo", () => {
    const erro = classificarTokenDeUso(token({ tipo: "REDEFINICAO_SENHA" }), "VERIFICACAO_EMAIL", AGORA);
    expect(erro?.code).toBe("AUTH_TOKEN_INVALIDO");
  });

  it("rejeita token de conta excluída", () => {
    const erro = classificarTokenDeUso(
      token({ statusConta: "EXCLUIDA", excluidoEm: AGORA }),
      "VERIFICACAO_EMAIL",
      AGORA,
    );
    expect(erro?.code).toBe("AUTH_TOKEN_INVALIDO");
  });

  it("rejeita token de conta com exclusão registrada", () => {
    const erro = classificarTokenDeUso(token({ excluidoEm: AGORA }), "VERIFICACAO_EMAIL", AGORA);
    expect(erro?.code).toBe("AUTH_TOKEN_INVALIDO");
  });

  it("bloqueia conta suspensa mesmo com token válido", () => {
    const erro = classificarTokenDeUso(token({ statusConta: "SUSPENSA" }), "VERIFICACAO_EMAIL", AGORA);
    expect(erro?.code).toBe("AUTH_CONTA_SUSPENSA");
    expect(erro?.status).toBe(403);
  });

  it("a suspensão tem precedência sobre uso único", () => {
    const erro = classificarTokenDeUso(
      token({ statusConta: "SUSPENSA", usadoEm: AGORA }),
      "VERIFICACAO_EMAIL",
      AGORA,
    );
    expect(erro?.code).toBe("AUTH_CONTA_SUSPENSA");
  });

  it("rejeita token já usado", () => {
    const erro = classificarTokenDeUso(token({ usadoEm: AGORA }), "VERIFICACAO_EMAIL", AGORA);
    expect(erro?.code).toBe("AUTH_TOKEN_JA_USADO");
  });

  it("rejeita token expirado", () => {
    const erro = classificarTokenDeUso(token({ expiraEm: NO_PASSADO }), "VERIFICACAO_EMAIL", AGORA);
    expect(erro?.code).toBe("AUTH_TOKEN_EXPIRADO");
  });

  it("considera expirado no instante exato da expiração", () => {
    const erro = classificarTokenDeUso(token({ expiraEm: AGORA }), "VERIFICACAO_EMAIL", AGORA);
    expect(erro?.code).toBe("AUTH_TOKEN_EXPIRADO");
  });

  it("aplica a mesma regra ao token de redefinição", () => {
    expect(
      classificarTokenDeUso(token({ tipo: "REDEFINICAO_SENHA" }), "REDEFINICAO_SENHA", AGORA),
    ).toBeNull();

    const suspensa = classificarTokenDeUso(
      token({ tipo: "REDEFINICAO_SENHA", statusConta: "SUSPENSA" }),
      "REDEFINICAO_SENHA",
      AGORA,
    );
    expect(suspensa?.code).toBe("AUTH_CONTA_SUSPENSA");
  });
});
