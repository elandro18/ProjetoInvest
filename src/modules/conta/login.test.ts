import { describe, expect, it, vi } from "vitest";

import { HASH_SENHA_INEXISTENTE, autenticar } from "./login";
import type { ContaRepositorio, CredenciaisConta, StatusConta } from "./repositorio";

const CONTA: CredenciaisConta = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Titular",
  email: "ana@exemplo.com",
  senhaHash: "$argon2id$hash",
  statusConta: "ATIVA",
  sessionVersion: 4,
  excluidoEm: null,
};

function repositorioCom(conta: CredenciaisConta | null): ContaRepositorio {
  return {
    buscarPorEmail: vi.fn(async () => null),
    criar: vi.fn(),
    buscarTokenPorHash: vi.fn(async () => null),
    ativarConta: vi.fn(async () => null),
    substituirTokenVerificacao: vi.fn(async () => undefined),
    buscarCredenciais: vi.fn(async () => conta),
    registrarLogin: vi.fn(async () => undefined),
    buscarSessao: vi.fn(async () => null),
  };
}

function comStatus(statusConta: StatusConta, extra: Partial<CredenciaisConta> = {}): CredenciaisConta {
  return { ...CONTA, statusConta, ...extra };
}

describe("autenticar", () => {
  it("normaliza o e-mail e devolve a identidade da conta ativa", async () => {
    const repositorio = repositorioCom(CONTA);
    const verificarSenha = vi.fn(async () => true);

    const resultado = await autenticar(
      { email: "  Ana@Exemplo.COM ", senha: "senha-correta" },
      { repositorio, verificarSenha },
    );

    expect(repositorio.buscarCredenciais).toHaveBeenCalledWith("ana@exemplo.com");
    expect(verificarSenha).toHaveBeenCalledWith(CONTA.senhaHash, "senha-correta");
    expect(resultado).toEqual({
      ok: true,
      value: {
        usuario: {
          id: CONTA.id,
          nome: CONTA.nome,
          email: CONTA.email,
          statusConta: "ATIVA",
          sessionVersion: 4,
        },
      },
    });
  });

  it("conta inexistente verifica o hash de referência e responde credencial inválida", async () => {
    const repositorio = repositorioCom(null);
    const verificarSenha = vi.fn(async () => false);

    const resultado = await autenticar(
      { email: "fantasma@exemplo.com", senha: "qualquer" },
      { repositorio, verificarSenha },
    );

    expect(verificarSenha).toHaveBeenCalledWith(HASH_SENHA_INEXISTENTE, "qualquer");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_CREDENCIAIS_INVALIDAS");
      expect(resultado.error.status).toBe(401);
    }
  });

  it("senha errada não revela o status pendente", async () => {
    const repositorio = repositorioCom(comStatus("PENDENTE_VERIFICACAO"));
    const verificarSenha = vi.fn(async () => false);

    const resultado = await autenticar(
      { email: CONTA.email, senha: "errada" },
      { repositorio, verificarSenha },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_CREDENCIAIS_INVALIDAS");
    }
  });

  it("conta pendente com senha correta pede verificação e permite reenvio", async () => {
    const repositorio = repositorioCom(comStatus("PENDENTE_VERIFICACAO"));
    const verificarSenha = vi.fn(async () => true);

    const resultado = await autenticar(
      { email: CONTA.email, senha: "correta" },
      { repositorio, verificarSenha },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_EMAIL_NAO_VERIFICADO");
      expect(resultado.error.status).toBe(403);
      expect(resultado.error.details).toEqual({ podeReenviar: true });
    }
  });

  it("conta suspensa responde 403 específico", async () => {
    const repositorio = repositorioCom(comStatus("SUSPENSA"));
    const verificarSenha = vi.fn(async () => true);

    const resultado = await autenticar(
      { email: CONTA.email, senha: "correta" },
      { repositorio, verificarSenha },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_CONTA_SUSPENSA");
      expect(resultado.error.status).toBe(403);
    }
  });

  it("conta excluída responde como credencial inválida", async () => {
    const repositorio = repositorioCom(comStatus("EXCLUIDA"));
    const verificarSenha = vi.fn(async () => true);

    const resultado = await autenticar(
      { email: CONTA.email, senha: "correta" },
      { repositorio, verificarSenha },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_CREDENCIAIS_INVALIDAS");
    }
  });

  it("conta com exclusão registrada mas status ativo não autentica", async () => {
    const repositorio = repositorioCom(comStatus("ATIVA", { excluidoEm: new Date() }));
    const verificarSenha = vi.fn(async () => true);

    const resultado = await autenticar(
      { email: CONTA.email, senha: "correta" },
      { repositorio, verificarSenha },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_CREDENCIAIS_INVALIDAS");
    }
  });
});
