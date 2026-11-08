import { describe, expect, it, vi } from "vitest";

import {
  MENSAGEM_CONTA_ENCERRADA,
  NOME_CONTA_ENCERRADA,
  emailAnonimizado,
  encerrarConta,
} from "./encerramento";
import type { ContaRepositorio, CredenciaisConta } from "./repositorio";

const AGORA = new Date("2026-11-08T12:00:00.000Z");

const CONTA: CredenciaisConta = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Titular",
  email: "ana@exemplo.com",
  senhaHash: "$argon2id$hash",
  statusConta: "ATIVA",
  sessionVersion: 3,
  excluidoEm: null,
};

function repositorioCom(conta: CredenciaisConta | null, encerrada = true): ContaRepositorio {
  return {
    buscarPorEmail: vi.fn(async () => null),
    criar: vi.fn(),
    buscarTokenPorHash: vi.fn(async () => null),
    ativarConta: vi.fn(async () => null),
    substituirTokenVerificacao: vi.fn(async () => undefined),
    substituirTokenRedefinicao: vi.fn(async () => undefined),
    buscarCredenciais: vi.fn(async () => null),
    buscarCredenciaisPorId: vi.fn(async () => conta),
    registrarLogin: vi.fn(async () => undefined),
    buscarSessao: vi.fn(async () => null),
    redefinirSenha: vi.fn(async () => true),
    encerrarConta: vi.fn(async () => encerrada),
  };
}

describe("emailAnonimizado", () => {
  it("gera endereço determinístico, único e fora de domínio real", () => {
    const email = emailAnonimizado(CONTA.id);

    expect(email).toBe(`excluido+${CONTA.id}@invalid.local`);
    expect(email).toBe(emailAnonimizado(CONTA.id));
    expect(email).not.toContain(CONTA.email);
  });
});

describe("encerrarConta", () => {
  it("valida a senha e anonimiza nome/e-mail na transação", async () => {
    const repositorio = repositorioCom(CONTA);
    const verificarSenha = vi.fn(async () => true);

    const resultado = await encerrarConta(
      { usuarioId: CONTA.id, senha: "senha-correta" },
      { repositorio, verificarSenha, agora: () => AGORA },
    );

    expect(resultado).toEqual({
      ok: true,
      value: { statusConta: "EXCLUIDA", mensagem: MENSAGEM_CONTA_ENCERRADA },
    });
    expect(verificarSenha).toHaveBeenCalledWith(CONTA.senhaHash, "senha-correta");
    expect(repositorio.encerrarConta).toHaveBeenCalledWith({
      usuarioId: CONTA.id,
      nomeAnonimizado: NOME_CONTA_ENCERRADA,
      emailAnonimizado: emailAnonimizado(CONTA.id),
      agora: AGORA,
    });
  });

  it("senha errada responde 401 genérico sem encerrar", async () => {
    const repositorio = repositorioCom(CONTA);
    const verificarSenha = vi.fn(async () => false);

    const resultado = await encerrarConta(
      { usuarioId: CONTA.id, senha: "errada" },
      { repositorio, verificarSenha, agora: () => AGORA },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_CREDENCIAIS_INVALIDAS");
      expect(resultado.error.status).toBe(401);
    }
    expect(repositorio.encerrarConta).not.toHaveBeenCalled();
  });

  it("conta já encerrada responde 409 sem checar a senha", async () => {
    const repositorio = repositorioCom({
      ...CONTA,
      statusConta: "EXCLUIDA",
      excluidoEm: AGORA,
    });
    const verificarSenha = vi.fn(async () => true);

    const resultado = await encerrarConta(
      { usuarioId: CONTA.id, senha: "senha-correta" },
      { repositorio, verificarSenha, agora: () => AGORA },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("CONTA_EXCLUSAO_BLOQUEADA");
      expect(resultado.error.status).toBe(409);
    }
    expect(verificarSenha).not.toHaveBeenCalled();
    expect(repositorio.encerrarConta).not.toHaveBeenCalled();
  });

  it("conta inexistente responde 401", async () => {
    const repositorio = repositorioCom(null);
    const verificarSenha = vi.fn(async () => true);

    const resultado = await encerrarConta(
      { usuarioId: CONTA.id, senha: "senha-correta" },
      { repositorio, verificarSenha, agora: () => AGORA },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("NAO_AUTENTICADO");
      expect(resultado.error.status).toBe(401);
    }
  });

  it("encerramento concorrente perde a corrida e responde 409", async () => {
    const repositorio = repositorioCom(CONTA, false);
    const verificarSenha = vi.fn(async () => true);

    const resultado = await encerrarConta(
      { usuarioId: CONTA.id, senha: "senha-correta" },
      { repositorio, verificarSenha, agora: () => AGORA },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("CONTA_EXCLUSAO_BLOQUEADA");
      expect(resultado.error.status).toBe(409);
    }
  });

  it("usa o relógio do sistema quando nenhum for injetado", async () => {
    const antes = Date.now();
    const repositorio = repositorioCom(CONTA);
    const verificarSenha = vi.fn(async () => true);

    const resultado = await encerrarConta(
      { usuarioId: CONTA.id, senha: "senha-correta" },
      { repositorio, verificarSenha },
    );

    expect(resultado.ok).toBe(true);
    const chamada = vi.mocked(repositorio.encerrarConta).mock.calls[0]?.[0];
    expect(chamada?.agora.getTime()).toBeGreaterThanOrEqual(antes);
  });
});
