import { describe, expect, it, vi } from "vitest";

import type { ContaRepositorio, TokenPersistido } from "./repositorio";
import { verificarEmail, type VerificacaoDeps } from "./verificacao";

const AGORA = new Date("2026-11-08T12:00:00.000Z");

const USUARIO_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN_ID = "22222222-2222-2222-2222-222222222222";

function repositorioFake(sobrescrever: Partial<ContaRepositorio> = {}): ContaRepositorio {
  return {
    buscarPorEmail: vi.fn(async () => null),
    criar: vi.fn(),
    buscarTokenPorHash: vi.fn(async () => null),
    ativarConta: vi.fn(async () => null),
    substituirTokenVerificacao: vi.fn(async () => undefined),
    substituirTokenRedefinicao: vi.fn(async () => undefined),
    buscarCredenciais: vi.fn(async () => null),
    buscarCredenciaisPorId: vi.fn(async () => null),
    registrarLogin: vi.fn(async () => undefined),
    buscarSessao: vi.fn(async () => null),
    redefinirSenha: vi.fn(async () => true),
    encerrarConta: vi.fn(async () => true),
    ...sobrescrever,
  };
}

function tokenValido(sobrescrever: Partial<TokenPersistido> = {}): TokenPersistido {
  return {
    id: TOKEN_ID,
    usuarioId: USUARIO_ID,
    tipo: "VERIFICACAO_EMAIL",
    expiraEm: new Date("2026-11-09T12:00:00.000Z"),
    usadoEm: null,
    statusConta: "PENDENTE_VERIFICACAO",
    excluidoEm: null,
    ...sobrescrever,
  };
}

function depsCom(registro: TokenPersistido | null, ativacao: { emailVerificadoEm: Date } | null) {
  const repositorio = repositorioFake({
    buscarTokenPorHash: vi.fn(async () => registro),
    ativarConta: vi.fn(async () => ativacao),
  });
  const hashToken = vi.fn((token: string) => `hash:${token}`);
  const deps: VerificacaoDeps = { repositorio, hashToken, agora: () => AGORA };

  return { deps, repositorio, hashToken };
}

function esperaErro(
  resultado: Awaited<ReturnType<typeof verificarEmail>>,
  codigo: string,
): void {
  expect(resultado.ok).toBe(false);
  if (!resultado.ok) {
    expect(resultado.error.code).toBe(codigo);
  }
}

describe("verificarEmail", () => {
  it("consome o token hash e ativa a conta, devolvendo o instante da verificação", async () => {
    const verificadoEm = new Date("2026-11-08T12:30:00.000Z");
    const { deps, repositorio, hashToken } = depsCom(tokenValido(), {
      emailVerificadoEm: verificadoEm,
    });

    const resultado = await verificarEmail({ token: "  token-abc  " }, deps);

    expect(resultado).toEqual({
      ok: true,
      value: { statusConta: "ATIVA", emailVerificadoEm: verificadoEm.toISOString() },
    });
    expect(hashToken).toHaveBeenCalledWith("token-abc");
    expect(repositorio.buscarTokenPorHash).toHaveBeenCalledWith("hash:token-abc");
    expect(repositorio.ativarConta).toHaveBeenCalledWith({
      tokenId: TOKEN_ID,
      usuarioId: USUARIO_ID,
      agora: AGORA,
    });
  });

  it("token vazio responde 400 sem consultar a persistência", async () => {
    const { deps, repositorio } = depsCom(null, null);

    const resultado = await verificarEmail({ token: "   " }, deps);

    esperaErro(resultado, "AUTH_TOKEN_INVALIDO");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(400);
    }
    expect(repositorio.buscarTokenPorHash).not.toHaveBeenCalled();
    expect(repositorio.ativarConta).not.toHaveBeenCalled();
  });

  it("token inexistente responde 400", async () => {
    const { deps, repositorio } = depsCom(null, null);

    const resultado = await verificarEmail({ token: "nao-existe" }, deps);

    esperaErro(resultado, "AUTH_TOKEN_INVALIDO");
    expect(repositorio.ativarConta).not.toHaveBeenCalled();
  });

  it("token de redefinição de senha não serve para verificar e-mail", async () => {
    const { deps } = depsCom(tokenValido({ tipo: "REDEFINICAO_SENHA" }), null);

    const resultado = await verificarEmail({ token: "token-abc" }, deps);

    esperaErro(resultado, "AUTH_TOKEN_INVALIDO");
  });

  it("token já usado responde 409", async () => {
    const { deps } = depsCom(
      tokenValido({ usadoEm: new Date("2026-11-08T11:00:00.000Z") }),
      null,
    );

    const resultado = await verificarEmail({ token: "token-abc" }, deps);

    esperaErro(resultado, "AUTH_TOKEN_JA_USADO");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(409);
    }
  });

  it("token expirado no instante atual responde 410", async () => {
    const { deps } = depsCom(tokenValido({ expiraEm: AGORA }), null);

    const resultado = await verificarEmail({ token: "token-abc" }, deps);

    esperaErro(resultado, "AUTH_TOKEN_EXPIRADO");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(410);
    }
  });

  it.each([
    ["conta excluída", tokenValido({ statusConta: "EXCLUIDA" })],
    ["exclusão registrada com status ativo", tokenValido({ statusConta: "ATIVA", excluidoEm: AGORA })],
  ])("%s invalida o token", async (_caso, registro) => {
    const { deps } = depsCom(registro, null);

    const resultado = await verificarEmail({ token: "token-abc" }, deps);

    esperaErro(resultado, "AUTH_TOKEN_INVALIDO");
  });

  it("token consumido concorrentemente responde 409", async () => {
    const { deps } = depsCom(tokenValido(), null);

    const resultado = await verificarEmail({ token: "token-abc" }, deps);

    esperaErro(resultado, "AUTH_TOKEN_JA_USADO");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(409);
    }
  });

  it("usa o relógio do sistema quando nenhum for injetado", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60 * 1000);
    const verificacao = new Date();
    const repositorio = repositorioFake({
      buscarTokenPorHash: vi.fn(async () => tokenValido({ expiraEm })),
      ativarConta: vi.fn(async () => ({ emailVerificadoEm: verificacao })),
    });

    const resultado = await verificarEmail(
      { token: "token-abc" },
      { repositorio, hashToken: (token) => `hash:${token}` },
    );

    expect(resultado.ok).toBe(true);
    expect(repositorio.ativarConta).toHaveBeenCalledOnce();
  });
});
