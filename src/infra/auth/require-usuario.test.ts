import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, buscarSessao, servicosConta } = vi.hoisted(() => ({
  auth: vi.fn(),
  buscarSessao: vi.fn(),
  servicosConta: vi.fn(() => ({ repositorio: { buscarSessao } })),
}));

vi.mock("./auth", () => ({ auth }));
vi.mock("../container/conta", () => ({ servicosConta }));

import { requireUsuario } from "./require-usuario";

const CONTA = {
  id: "44444444-4444-4444-4444-444444444444",
  nome: "Davi Titular",
  email: "davi@exemplo.com",
  statusConta: "ATIVA" as const,
  sessionVersion: 1,
  excluidoEm: null,
};

function sessao(usuario: Partial<{ id: string; sessionVersion: number }> = {}) {
  return {
    user: { id: CONTA.id, sessionVersion: 1, ...usuario },
    expires: "2026-11-08T20:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUsuario", () => {
  it("devolve usuário e nome/e-mail da conta ativa com versão compatível", async () => {
    auth.mockResolvedValue(sessao());
    buscarSessao.mockResolvedValue(CONTA);

    await expect(requireUsuario()).resolves.toEqual({
      usuarioId: CONTA.id,
      nome: CONTA.nome,
      email: CONTA.email,
    });
    expect(buscarSessao).toHaveBeenCalledWith(CONTA.id);
  });

  it("rejeita requisição sem sessão", async () => {
    auth.mockResolvedValue(null);

    await expect(requireUsuario()).rejects.toMatchObject({ code: "NAO_AUTENTICADO", status: 401 });
  });

  it("rejeita sessão sem id de usuário", async () => {
    auth.mockResolvedValue({ user: {}, expires: "" });

    await expect(requireUsuario()).rejects.toMatchObject({ code: "NAO_AUTENTICADO" });
  });

  it.each([
    ["conta inexistente", null],
    ["conta excluída", { ...CONTA, excluidoEm: new Date() }],
    ["conta suspensa", { ...CONTA, statusConta: "SUSPENSA" }],
  ])("rejeita %s", async (_caso, conta) => {
    auth.mockResolvedValue(sessao());
    buscarSessao.mockResolvedValue(conta);

    await expect(requireUsuario()).rejects.toMatchObject({ code: "NAO_AUTENTICADO" });
  });

  it("rejeita sessão de versão antiga com AUTH_SESSAO_EXPIRADA", async () => {
    auth.mockResolvedValue(sessao({ sessionVersion: 0 }));
    buscarSessao.mockResolvedValue({ ...CONTA, sessionVersion: 1 });

    await expect(requireUsuario()).rejects.toMatchObject({
      code: "AUTH_SESSAO_EXPIRADA",
      status: 401,
    });
  });
});
