import { describe, expect, it, vi } from "vitest";

import type { Mailer } from "./mailer";
import type { ContaRepositorio, ContaResumo } from "./repositorio";
import { MENSAGEM_REENVIO_NEUTRA, reenviarVerificacao, type ReenvioDeps } from "./reenvio";
import { VALIDADE_VERIFICACAO_EMAIL_MS } from "./token";

const AGORA = new Date("2026-11-08T12:00:00.000Z");

const CONTA: ContaResumo = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Titular",
  email: "ana@exemplo.com",
  statusConta: "PENDENTE_VERIFICACAO",
  excluidoEm: null,
};

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

function mailerFake(): Mailer {
  return {
    enviarVerificacaoEmail: vi.fn(async () => undefined),
    enviarRedefinicaoSenha: vi.fn(async () => undefined),
  };
}

function depsCom(sobrescrever: Partial<ReenvioDeps> = {}): ReenvioDeps {
  return {
    repositorio: repositorioFake(),
    mailer: mailerFake(),
    gerarToken: () => ({ token: "token-puro", hash: "hash-token" }),
    appUrl: "http://localhost:3000/",
    agora: () => AGORA,
    ...sobrescrever,
  };
}

describe("reenviarVerificacao", () => {
  it("conta pendente recebe novo token de 24 h e o link de verificação", async () => {
    const deps = depsCom({
      repositorio: repositorioFake({ buscarPorEmail: vi.fn(async () => CONTA) }),
    });

    const resultado = await reenviarVerificacao({ email: "  Ana@Exemplo.COM " }, deps);

    expect(resultado).toEqual({
      ok: true,
      value: { message: MENSAGEM_REENVIO_NEUTRA },
    });
    expect(deps.repositorio.buscarPorEmail).toHaveBeenCalledWith("ana@exemplo.com");

    const expiraEm = new Date(AGORA.getTime() + VALIDADE_VERIFICACAO_EMAIL_MS);
    expect(deps.repositorio.substituirTokenVerificacao).toHaveBeenCalledWith({
      usuarioId: CONTA.id,
      token: { hash: "hash-token", expiraEm },
      agora: AGORA,
    });
    expect(deps.mailer.enviarVerificacaoEmail).toHaveBeenCalledWith({
      para: CONTA.email,
      nome: CONTA.nome,
      link: "http://localhost:3000/verificar-email?token=token-puro",
      expiraEm,
    });
  });

  it.each([
    ["e-mail inexistente", null],
    ["conta já ativa", { ...CONTA, statusConta: "ATIVA" as const }],
    ["conta suspensa", { ...CONTA, statusConta: "SUSPENSA" as const }],
    ["conta excluída", { ...CONTA, statusConta: "EXCLUIDA" as const }],
    ["exclusão registrada em conta pendente", { ...CONTA, excluidoEm: AGORA }],
  ])("%s recebe a mesma mensagem neutra sem emitir token", async (_caso, conta) => {
    const deps = depsCom({
      repositorio: repositorioFake({ buscarPorEmail: vi.fn(async () => conta) }),
    });

    const resultado = await reenviarVerificacao({ email: CONTA.email }, deps);

    expect(resultado).toEqual({
      ok: true,
      value: { message: MENSAGEM_REENVIO_NEUTRA },
    });
    expect(deps.repositorio.substituirTokenVerificacao).not.toHaveBeenCalled();
    expect(deps.mailer.enviarVerificacaoEmail).not.toHaveBeenCalled();
  });

  it("usa o relógio do sistema quando nenhum for injetado", async () => {
    const antes = Date.now();
    const deps = depsCom({
      repositorio: repositorioFake({ buscarPorEmail: vi.fn(async () => CONTA) }),
      agora: undefined,
    });

    const resultado = await reenviarVerificacao({ email: CONTA.email }, deps);

    expect(resultado.ok).toBe(true);
    const chamada = vi.mocked(deps.repositorio.substituirTokenVerificacao).mock.calls[0]?.[0];
    const expiraEm = chamada?.token.expiraEm.getTime() ?? 0;
    expect(expiraEm).toBeGreaterThanOrEqual(antes + VALIDADE_VERIFICACAO_EMAIL_MS);
    expect(expiraEm).toBeLessThanOrEqual(Date.now() + VALIDADE_VERIFICACAO_EMAIL_MS + 1_000);
  });
});
