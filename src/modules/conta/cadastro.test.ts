import { describe, expect, it, vi } from "vitest";

import type { Mailer } from "./mailer";
import type {
  ContaRepositorio,
  ContaResumo,
  NovaConta,
  StatusConta,
} from "./repositorio";
import { EmailJaCadastradoError } from "./repositorio";
import { cadastrar, type CadastroComando, type CadastroDeps } from "./cadastro";
import { VERSAO_POLITICA_PRIVACIDADE, VERSAO_TERMOS_USO } from "./legal";
import { VALIDADE_VERIFICACAO_EMAIL_MS } from "./token";

const AGORA = new Date("2026-11-08T12:00:00.000Z");

const COMANDO: CadastroComando = {
  nome: "  Ana Titular  ",
  email: "  Ana@Exemplo.COM ",
  senha: "SenhaForte123!",
  aceiteTermos: true,
  aceitePrivacidade: true,
  versaoTermos: VERSAO_TERMOS_USO,
  versaoPrivacidade: VERSAO_POLITICA_PRIVACIDADE,
  ipHash: "ip-hash",
};

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
    criar: vi.fn(
      async (conta: NovaConta) => ({
        id: "novo-id",
        email: conta.email,
        statusConta: "PENDENTE_VERIFICACAO" as StatusConta,
      }),
    ),
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

function depsCom(sobrescrever: Partial<CadastroDeps> = {}): CadastroDeps {
  return {
    repositorio: repositorioFake(),
    mailer: mailerFake(),
    hashSenha: vi.fn(async () => "hash-senha"),
    gerarToken: () => ({ token: "token-puro", hash: "hash-token" }),
    appUrl: "https://app.exemplo/",
    agora: () => AGORA,
    ...sobrescrever,
  };
}

function esperaErro(resultado: Awaited<ReturnType<typeof cadastrar>>, codigo: string): void {
  expect(resultado.ok).toBe(false);
  if (!resultado.ok) {
    expect(resultado.error.code).toBe(codigo);
  }
}

describe("cadastrar", () => {
  it("normaliza nome/e-mail, registra aceites versionados e envia o link de verificação", async () => {
    const deps = depsCom();

    const resultado = await cadastrar(COMANDO, deps);

    expect(resultado).toEqual({
      ok: true,
      value: { id: "novo-id", email: "ana@exemplo.com", statusConta: "PENDENTE_VERIFICACAO" },
    });
    expect(deps.repositorio.buscarPorEmail).toHaveBeenCalledWith("ana@exemplo.com");
    expect(deps.hashSenha).toHaveBeenCalledWith("SenhaForte123!");

    const expiraEm = new Date(AGORA.getTime() + VALIDADE_VERIFICACAO_EMAIL_MS);
    expect(deps.repositorio.criar).toHaveBeenCalledWith({
      nome: "Ana Titular",
      email: "ana@exemplo.com",
      senhaHash: "hash-senha",
      aceites: [
        { tipo: "TERMOS_USO", versao: VERSAO_TERMOS_USO, ipHash: "ip-hash" },
        {
          tipo: "POLITICA_PRIVACIDADE",
          versao: VERSAO_POLITICA_PRIVACIDADE,
          ipHash: "ip-hash",
        },
      ],
      token: { hash: "hash-token", expiraEm },
    });
    expect(deps.mailer.enviarVerificacaoEmail).toHaveBeenCalledWith({
      para: "ana@exemplo.com",
      nome: "Ana Titular",
      link: "https://app.exemplo/verificar-email?token=token-puro",
      expiraEm,
    });
  });

  it("e-mail duplicado com caixa diferente responde 409 sem criar conta", async () => {
    const deps = depsCom({
      repositorio: repositorioFake({ buscarPorEmail: vi.fn(async () => CONTA) }),
    });

    const resultado = await cadastrar(
      { ...COMANDO, email: "  ANA@EXEMPLO.com " },
      deps,
    );

    esperaErro(resultado, "AUTH_EMAIL_JA_CADASTRADO");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(409);
    }
    expect(deps.repositorio.buscarPorEmail).toHaveBeenCalledWith("ana@exemplo.com");
    expect(deps.repositorio.criar).not.toHaveBeenCalled();
    expect(deps.hashSenha).not.toHaveBeenCalled();
    expect(deps.mailer.enviarVerificacaoEmail).not.toHaveBeenCalled();
  });

  it("violação de unicidade na transação (corrida) vira 409 e não envia e-mail", async () => {
    const deps = depsCom({
      repositorio: repositorioFake({
        criar: vi.fn(async () => {
          throw new EmailJaCadastradoError();
        }),
      }),
    });

    const resultado = await cadastrar(COMANDO, deps);

    esperaErro(resultado, "AUTH_EMAIL_JA_CADASTRADO");
    expect(deps.mailer.enviarVerificacaoEmail).not.toHaveBeenCalled();
  });

  it("erro inesperado da persistência é propagado e não envia e-mail", async () => {
    const criar = vi.fn(async () => {
      throw new Error("banco fora");
    });
    const deps = depsCom({ repositorio: repositorioFake({ criar }) });

    await expect(cadastrar(COMANDO, deps)).rejects.toThrow("banco fora");
    expect(deps.mailer.enviarVerificacaoEmail).not.toHaveBeenCalled();
  });

  it.each(["curta", "password123", "1234567890"])(
    "senha fraca (%s) responde 422 sem tocar em persistência",
    async (senha) => {
      const deps = depsCom();

      const resultado = await cadastrar({ ...COMANDO, senha }, deps);

      esperaErro(resultado, "AUTH_SENHA_FRACA");
      if (!resultado.ok) {
        expect(resultado.error.status).toBe(422);
      }
      expect(deps.repositorio.buscarPorEmail).not.toHaveBeenCalled();
      expect(deps.repositorio.criar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["sem aceite dos termos", { aceiteTermos: false }],
    ["sem aceite da privacidade", { aceitePrivacidade: false }],
    ["sem nenhum aceite", { aceiteTermos: false, aceitePrivacidade: false }],
  ])("%s responde 422 sem criar conta", async (_caso, sobras) => {
    const deps = depsCom();

    const resultado = await cadastrar({ ...COMANDO, ...sobras }, deps);

    esperaErro(resultado, "AUTH_ACEITE_OBRIGATORIO");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(422);
    }
    expect(deps.repositorio.criar).not.toHaveBeenCalled();
    expect(deps.mailer.enviarVerificacaoEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["termos antigos", { versaoTermos: "2025-01-01" }],
    ["privacidade antiga", { versaoPrivacidade: "2025-01-01" }],
    ["ambas antigas", { versaoTermos: "2025-01-01", versaoPrivacidade: "2025-01-01" }],
    ["versão vazia", { versaoTermos: "" }],
  ])("%s responde versão desatualizada", async (_caso, sobras) => {
    const deps = depsCom();

    const resultado = await cadastrar({ ...COMANDO, ...sobras }, deps);

    esperaErro(resultado, "AUTH_VERSAO_TERMOS_DESATUALIZADA");
    if (!resultado.ok) {
      expect(resultado.error.status).toBe(422);
    }
    expect(deps.repositorio.criar).not.toHaveBeenCalled();
  });

  it("versões com espaços em volta são aceitas e persistidas normalizadas", async () => {
    const deps = depsCom();

    const resultado = await cadastrar(
      {
        ...COMANDO,
        versaoTermos: `  ${VERSAO_TERMOS_USO} `,
        versaoPrivacidade: ` ${VERSAO_POLITICA_PRIVACIDADE}  `,
      },
      deps,
    );

    expect(resultado.ok).toBe(true);
    expect(deps.repositorio.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        aceites: [
          { tipo: "TERMOS_USO", versao: VERSAO_TERMOS_USO, ipHash: "ip-hash" },
          {
            tipo: "POLITICA_PRIVACIDADE",
            versao: VERSAO_POLITICA_PRIVACIDADE,
            ipHash: "ip-hash",
          },
        ],
      }),
    );
  });

  it("usa o relógio do sistema quando nenhum for injetado", async () => {
    const antes = Date.now();
    const deps = depsCom({ agora: undefined });

    const resultado = await cadastrar(COMANDO, deps);

    expect(resultado.ok).toBe(true);
    const chamada = vi.mocked(deps.repositorio.criar).mock.calls[0]?.[0];
    expect(chamada).toBeDefined();
    const expiraEm = chamada?.token.expiraEm.getTime() ?? 0;
    expect(expiraEm).toBeGreaterThanOrEqual(antes + VALIDADE_VERIFICACAO_EMAIL_MS);
    expect(expiraEm).toBeLessThanOrEqual(Date.now() + VALIDADE_VERIFICACAO_EMAIL_MS + 1_000);
  });

  it("mantém ipHash nulo quando o IP de origem não foi resolvido", async () => {
    const deps = depsCom();

    await cadastrar({ ...COMANDO, ipHash: null }, deps);

    expect(deps.repositorio.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        aceites: [
          { tipo: "TERMOS_USO", versao: VERSAO_TERMOS_USO, ipHash: null },
          { tipo: "POLITICA_PRIVACIDADE", versao: VERSAO_POLITICA_PRIVACIDADE, ipHash: null },
        ],
      }),
    );
  });
});
