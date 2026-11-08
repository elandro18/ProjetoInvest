import { describe, expect, it, vi } from "vitest";

import type { Mailer } from "./mailer";
import type {
  ContaRepositorio,
  ContaResumo,
  CredenciaisConta,
  TokenPersistido,
} from "./repositorio";
import {
  MENSAGEM_REDEFINICAO_NEUTRA,
  MENSAGEM_SENHA_REDEFINIDA,
  redefinirSenha,
  solicitarRedefinicaoSenha,
} from "./reset";

const AGORA = new Date("2026-11-08T12:00:00.000Z");

const CONTA: ContaResumo = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Titular",
  email: "ana@exemplo.com",
  statusConta: "ATIVA",
  excluidoEm: null,
};

function repositorioCom(sobrescrever: Partial<ContaRepositorio> = {}): ContaRepositorio {
  return {
    buscarPorEmail: vi.fn(async () => null),
    criar: vi.fn(),
    buscarTokenPorHash: vi.fn(async () => null),
    ativarConta: vi.fn(async () => null),
    substituirTokenVerificacao: vi.fn(async () => undefined),
    substituirTokenRedefinicao: vi.fn(async () => undefined),
    buscarCredenciais: vi.fn(async () => null),
    buscarCredenciaisPorId: vi.fn(async (): Promise<CredenciaisConta | null> => null),
    registrarLogin: vi.fn(async () => undefined),
    buscarSessao: vi.fn(async () => null),
    redefinirSenha: vi.fn(async () => true),
    encerrarConta: vi.fn(async () => true),
    ...sobrescrever,
  };
}

function mailerFake(): Mailer {
  return {
    enviarVerificacaoEmail: vi.fn(async () => undefined),
    enviarRedefinicaoSenha: vi.fn(async () => undefined),
  };
}

function tokenValido(sobrescrever: Partial<TokenPersistido> = {}): TokenPersistido {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    usuarioId: CONTA.id,
    tipo: "REDEFINICAO_SENHA",
    expiraEm: new Date("2026-11-08T13:00:00.000Z"),
    usadoEm: null,
    statusConta: "ATIVA",
    excluidoEm: null,
    ...sobrescrever,
  };
}

describe("solicitarRedefinicaoSenha", () => {
  it("emite token de 1 h, invalida os anteriores e envia o link", async () => {
    const repositorio = repositorioCom({ buscarPorEmail: vi.fn(async () => CONTA) });
    const mailer = mailerFake();

    const resultado = await solicitarRedefinicaoSenha(
      { email: "  Ana@Exemplo.COM " },
      {
        repositorio,
        mailer,
        gerarToken: () => ({ token: "token-puro", hash: "hash-token" }),
        appUrl: "http://localhost:3000/",
        agora: () => AGORA,
      },
    );

    expect(resultado).toEqual({ ok: true, value: { message: MENSAGEM_REDEFINICAO_NEUTRA } });
    expect(repositorio.buscarPorEmail).toHaveBeenCalledWith("ana@exemplo.com");
    expect(repositorio.substituirTokenRedefinicao).toHaveBeenCalledWith({
      usuarioId: CONTA.id,
      token: { hash: "hash-token", expiraEm: new Date("2026-11-08T13:00:00.000Z") },
      agora: AGORA,
    });
    expect(mailer.enviarRedefinicaoSenha).toHaveBeenCalledWith({
      para: CONTA.email,
      nome: CONTA.nome,
      link: "http://localhost:3000/redefinir-senha?token=token-puro",
      expiraEm: new Date("2026-11-08T13:00:00.000Z"),
    });
  });

  it("e-mail inexistente responde a mesma mensagem sem emitir token", async () => {
    const repositorio = repositorioCom();
    const mailer = mailerFake();

    const resultado = await solicitarRedefinicaoSenha(
      { email: "fantasma@exemplo.com" },
      {
        repositorio,
        mailer,
        gerarToken: () => ({ token: "token-puro", hash: "hash-token" }),
        appUrl: "http://localhost:3000",
        agora: () => AGORA,
      },
    );

    expect(resultado).toEqual({ ok: true, value: { message: MENSAGEM_REDEFINICAO_NEUTRA } });
    expect(repositorio.substituirTokenRedefinicao).not.toHaveBeenCalled();
    expect(mailer.enviarRedefinicaoSenha).not.toHaveBeenCalled();
  });

  it("conta encerrada recebe a mesma resposta neutra sem token", async () => {
    const repositorio = repositorioCom({
      buscarPorEmail: vi.fn(async () => ({
        ...CONTA,
        statusConta: "EXCLUIDA" as const,
        excluidoEm: AGORA,
      })),
    });
    const mailer = mailerFake();

    const resultado = await solicitarRedefinicaoSenha(
      { email: CONTA.email },
      {
        repositorio,
        mailer,
        gerarToken: () => ({ token: "token-puro", hash: "hash-token" }),
        appUrl: "http://localhost:3000",
        agora: () => AGORA,
      },
    );

    expect(resultado).toEqual({ ok: true, value: { message: MENSAGEM_REDEFINICAO_NEUTRA } });
    expect(repositorio.substituirTokenRedefinicao).not.toHaveBeenCalled();
    expect(mailer.enviarRedefinicaoSenha).not.toHaveBeenCalled();
  });

  it("conta pendente de verificação ainda pode redefinir a senha", async () => {
    const repositorio = repositorioCom({
      buscarPorEmail: vi.fn(async () => ({
        ...CONTA,
        statusConta: "PENDENTE_VERIFICACAO" as const,
      })),
    });
    const mailer = mailerFake();

    await solicitarRedefinicaoSenha(
      { email: CONTA.email },
      {
        repositorio,
        mailer,
        gerarToken: () => ({ token: "token-puro", hash: "hash-token" }),
        appUrl: "http://localhost:3000",
        agora: () => AGORA,
      },
    );

    expect(repositorio.substituirTokenRedefinicao).toHaveBeenCalledOnce();
    expect(mailer.enviarRedefinicaoSenha).toHaveBeenCalledOnce();
  });
});

describe("redefinirSenha", () => {
  function depsCom(registro: TokenPersistido | null, trocada = true) {
    const repositorio = repositorioCom({
      buscarTokenPorHash: vi.fn(async () => registro),
      redefinirSenha: vi.fn(async () => trocada),
    });
    const hashSenha = vi.fn(async () => "novo-hash");
    const hashToken = vi.fn((token: string) => `hash:${token}`);

    return {
      repositorio,
      hashSenha,
      hashToken,
      deps: { repositorio, hashSenha, hashToken, agora: () => AGORA },
    };
  }

  it("consome o token, grava o novo hash e responde senha redefinida", async () => {
    const { deps, repositorio, hashSenha, hashToken } = depsCom(tokenValido());

    const resultado = await redefinirSenha(
      { token: " token-x ", novaSenha: "senha-forte-123" },
      deps,
    );

    expect(resultado).toEqual({ ok: true, value: { message: MENSAGEM_SENHA_REDEFINIDA } });
    expect(hashToken).toHaveBeenCalledWith("token-x");
    expect(repositorio.buscarTokenPorHash).toHaveBeenCalledWith("hash:token-x");
    expect(hashSenha).toHaveBeenCalledWith("senha-forte-123");
    expect(repositorio.redefinirSenha).toHaveBeenCalledWith({
      tokenId: tokenValido().id,
      usuarioId: CONTA.id,
      senhaHash: "novo-hash",
      agora: AGORA,
    });
  });

  it("token vazio responde 400 sem consultar o banco", async () => {
    const { deps, repositorio } = depsCom(null);

    const resultado = await redefinirSenha({ token: "  ", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_INVALIDO");
      expect(resultado.error.status).toBe(400);
    }
    expect(repositorio.buscarTokenPorHash).not.toHaveBeenCalled();
  });

  it("token desconhecido responde 400", async () => {
    const { deps } = depsCom(null);

    const resultado = await redefinirSenha({ token: "nao-existe", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_INVALIDO");
    }
  });

  it("token de verificação de e-mail não serve para redefinir senha", async () => {
    const { deps } = depsCom(tokenValido({ tipo: "VERIFICACAO_EMAIL" }));

    const resultado = await redefinirSenha({ token: "token-x", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_INVALIDO");
    }
  });

  it("token já usado responde 409", async () => {
    const { deps } = depsCom(tokenValido({ usadoEm: new Date("2026-11-08T11:00:00.000Z") }));

    const resultado = await redefinirSenha({ token: "token-x", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_JA_USADO");
      expect(resultado.error.status).toBe(409);
    }
  });

  it("token expirado responde 410", async () => {
    const { deps } = depsCom(tokenValido({ expiraEm: AGORA }));

    const resultado = await redefinirSenha({ token: "token-x", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_EXPIRADO");
      expect(resultado.error.status).toBe(410);
    }
  });

  it("conta encerrada invalida o token", async () => {
    const { deps } = depsCom(tokenValido({ statusConta: "EXCLUIDA" }));

    const resultado = await redefinirSenha({ token: "token-x", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_INVALIDO");
    }
  });

  it.each(["curta", "password123", "1234567890"])(
    "senha fraca (%s) responde 422 sem gravar hash",
    async (novaSenha) => {
      const { deps, repositorio, hashSenha } = depsCom(tokenValido());

      const resultado = await redefinirSenha({ token: "token-x", novaSenha }, deps);

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error.code).toBe("AUTH_SENHA_FRACA");
        expect(resultado.error.status).toBe(422);
      }
      expect(hashSenha).not.toHaveBeenCalled();
      expect(repositorio.redefinirSenha).not.toHaveBeenCalled();
    },
  );

  it("token consumido concorrentemente responde 409", async () => {
    const { deps } = depsCom(tokenValido(), false);

    const resultado = await redefinirSenha({ token: "token-x", novaSenha: "senha-forte-123" }, deps);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("AUTH_TOKEN_JA_USADO");
      expect(resultado.error.status).toBe(409);
    }
  });
});
