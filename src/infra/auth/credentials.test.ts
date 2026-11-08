import { beforeEach, describe, expect, it, vi } from "vitest";

const { buscarCredenciais, registrarLogin, verificarSenha, servicosConta } = vi.hoisted(() => ({
  buscarCredenciais: vi.fn(),
  registrarLogin: vi.fn(),
  verificarSenha: vi.fn(),
  servicosConta: vi.fn(),
}));

vi.mock("../container/conta", () => ({ servicosConta }));

import { autorizarCredenciais } from "./credentials";

const CONTA = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Bruno Titular",
  email: "bruno@exemplo.com",
  senhaHash: "$argon2id$hash",
  statusConta: "ATIVA" as const,
  sessionVersion: 2,
  excluidoEm: null,
};

const AGORA = new Date("2026-11-08T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  servicosConta.mockReturnValue({
    repositorio: { buscarCredenciais, registrarLogin },
    verificarSenha,
    agora: () => AGORA,
  });
});

describe("autorizarCredenciais", () => {
  it("devolve a identidade e registra o login", async () => {
    buscarCredenciais.mockResolvedValue(CONTA);
    verificarSenha.mockResolvedValue(true);

    const identidade = await autorizarCredenciais({
      email: "bruno@exemplo.com",
      senha: "senha-correta",
    });

    expect(identidade).toEqual({
      id: CONTA.id,
      nome: CONTA.nome,
      email: CONTA.email,
      statusConta: "ATIVA",
      sessionVersion: 2,
    });
    expect(registrarLogin).toHaveBeenCalledWith(CONTA.id, AGORA);
  });

  it("recusa payload inválido sem consultar o banco", async () => {
    await expect(autorizarCredenciais({ email: "sem-arroba", senha: "" })).resolves.toBeNull();
    expect(buscarCredenciais).not.toHaveBeenCalled();
  });

  it("devolve null quando a senha não confere", async () => {
    buscarCredenciais.mockResolvedValue(CONTA);
    verificarSenha.mockResolvedValue(false);

    await expect(
      autorizarCredenciais({ email: CONTA.email, senha: "errada" }),
    ).resolves.toBeNull();
    expect(registrarLogin).not.toHaveBeenCalled();
  });

  it("devolve null para conta inexistente", async () => {
    buscarCredenciais.mockResolvedValue(null);
    verificarSenha.mockResolvedValue(false);

    await expect(
      autorizarCredenciais({ email: "ninguem@exemplo.com", senha: "qualquer" }),
    ).resolves.toBeNull();
  });
});
