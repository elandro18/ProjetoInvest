import { describe, expect, it } from "vitest";

import {
  AppError,
  ERROR_CATALOG,
  appError,
  errors,
  type AppErrorCode,
  type HttpStatus,
} from "./errors";

const STATUS_POR_CODIGO: Record<AppErrorCode, HttpStatus> = {
  VALIDACAO: 422,
  REQUISICAO_MALFORMADA: 400,
  NAO_AUTENTICADO: 401,
  AUTH_SESSAO_EXPIRADA: 401,
  AUTH_EMAIL_JA_CADASTRADO: 409,
  AUTH_SENHA_FRACA: 422,
  AUTH_ACEITE_OBRIGATORIO: 422,
  AUTH_VERSAO_TERMOS_DESATUALIZADA: 422,
  AUTH_CREDENCIAIS_INVALIDAS: 401,
  AUTH_EMAIL_NAO_VERIFICADO: 403,
  AUTH_CONTA_SUSPENSA: 403,
  AUTH_TOKEN_INVALIDO: 400,
  AUTH_TOKEN_EXPIRADO: 410,
  AUTH_TOKEN_JA_USADO: 409,
  CONTA_EXCLUSAO_BLOQUEADA: 409,
  ATIVO_NAO_ENCONTRADO: 404,
  ATIVO_TICKER_DUPLICADO: 409,
  ATIVO_TICKER_INVALIDO: 422,
  ATIVO_SEGMENTO_OBRIGATORIO: 422,
  ATIVO_SEGMENTO_INVALIDO: 422,
  ATIVO_CLASSE_INVALIDA: 422,
  ATIVO_CNPJ_INVALIDO: 422,
  ATIVO_CLASSE_IMUTAVEL: 422,
  SEM_PERMISSAO: 403,
  RECURSO_NAO_ENCONTRADO: 404,
  RATE_LIMIT_EXCEDIDO: 429,
  ERRO_INTERNO: 500,
  BANCO_INDISPONIVEL: 503,
  MIGRATION_PENDENTE: 500,
  INT_PROVEDOR_INDISPONIVEL: 503,
  INT_TIMEOUT: 504,
  INT_LIMITE_EXCEDIDO: 429,
  INT_RESPOSTA_INVALIDA: 502,
  INT_OPERACAO_NAO_SUPORTADA: 422,
  INT_FALHA_AUTENTICACAO_PROVEDOR: 502,
  INT_ATIVO_NAO_ENCONTRADO: 404,
  INT_DADOS_INCOMPLETOS: 206,
};

describe("ERROR_CATALOG", () => {
  it.each(Object.keys(STATUS_POR_CODIGO) as AppErrorCode[])(
    "mapeia %s para o status do catálogo",
    (code) => {
      const error = new AppError(code);

      expect(error.code).toBe(code);
      expect(error.status).toBe(STATUS_POR_CODIGO[code]);
      expect(ERROR_CATALOG[code].status).toBe(STATUS_POR_CODIGO[code]);
      expect(ERROR_CATALOG[code].message.length).toBeGreaterThan(0);
    },
  );

  it("mantém o status e a mensagem consistentes entre catálogo e instância", () => {
    const error = new AppError("INT_TIMEOUT");

    expect(error.message).toBe(ERROR_CATALOG.INT_TIMEOUT.message);
    expect(error.status).toBe(504);
  });
});

describe("AppError", () => {
  it("é identificado por isAppError", () => {
    expect(AppError.isAppError(new AppError("ERRO_INTERNO"))).toBe(true);
    expect(AppError.isAppError(new Error("comum"))).toBe(false);
    expect(AppError.isAppError("ERRO_INTERNO")).toBe(false);
    expect(AppError.isAppError(null)).toBe(false);
  });

  it("aceita mensagem sobrescrita sem perder o status do código", () => {
    const error = new AppError("VALIDACAO", { message: "Campo obrigatório." });

    expect(error.message).toBe("Campo obrigatório.");
    expect(error.status).toBe(422);
    expect(error.code).toBe("VALIDACAO");
  });

  it("preserva a causa sem serializá-la", () => {
    const cause = new Error("detalhe interno");
    const error = new AppError("ERRO_INTERNO", { cause });

    expect(error.cause).toBe(cause);
    expect(JSON.stringify(error)).not.toContain("detalhe interno");
  });

  it("serializa em JSON sem stack e sem causa", () => {
    const error = new AppError("ERRO_INTERNO", { details: { traceId: "abc" } });
    const json = error.toJSON();

    expect(json).toEqual({
      code: "ERRO_INTERNO",
      message: ERROR_CATALOG.ERRO_INTERNO.message,
      details: { traceId: "abc" },
    });
    expect(json).not.toHaveProperty("stack");
  });

  it("omite details quando não há detalhes", () => {
    expect(new AppError("RECURSO_NAO_ENCONTRADO").toJSON()).toEqual({
      code: "RECURSO_NAO_ENCONTRADO",
      message: ERROR_CATALOG.RECURSO_NAO_ENCONTRADO.message,
    });
  });
});

describe("factory genérica appError", () => {
  it("cria a instância com código e opções", () => {
    const error = appError("SEM_PERMISSAO", { details: { recurso: "carteira" } });

    expect(error.code).toBe("SEM_PERMISSAO");
    expect(error.status).toBe(403);
    expect(error.details).toEqual({ recurso: "carteira" });
  });
});

describe("factories nomeadas", () => {
  it("validacao monta details.errors com um item por campo", () => {
    const error = errors.validacao([{ field: "email", message: "inválido" }]);

    expect(error.code).toBe("VALIDACAO");
    expect(error.status).toBe(422);
    expect(error.details).toEqual({ errors: [{ field: "email", message: "inválido" }] });
  });

  it("validacao aceita mensagem customizada", () => {
    const error = errors.validacao([], "Dados inválidos.");

    expect(error.message).toBe("Dados inválidos.");
  });

  it.each([
    ["requisicaoMalformada", "REQUISICAO_MALFORMADA", 400],
    ["naoAutenticado", "NAO_AUTENTICADO", 401],
    ["authSessaoExpirada", "AUTH_SESSAO_EXPIRADA", 401],
    ["authEmailJaCadastrado", "AUTH_EMAIL_JA_CADASTRADO", 409],
    ["authSenhaFraca", "AUTH_SENHA_FRACA", 422],
    ["authAceiteObrigatorio", "AUTH_ACEITE_OBRIGATORIO", 422],
    ["authVersaoTermosDesatualizada", "AUTH_VERSAO_TERMOS_DESATUALIZADA", 422],
    ["authCredenciaisInvalidas", "AUTH_CREDENCIAIS_INVALIDAS", 401],
    ["authEmailNaoVerificado", "AUTH_EMAIL_NAO_VERIFICADO", 403],
    ["authContaSuspensa", "AUTH_CONTA_SUSPENSA", 403],
    ["authTokenInvalido", "AUTH_TOKEN_INVALIDO", 400],
    ["authTokenExpirado", "AUTH_TOKEN_EXPIRADO", 410],
    ["authTokenJaUsado", "AUTH_TOKEN_JA_USADO", 409],
    ["contaExclusaoBloqueada", "CONTA_EXCLUSAO_BLOQUEADA", 409],
    ["semPermissao", "SEM_PERMISSAO", 403],
    ["recursoNaoEncontrado", "RECURSO_NAO_ENCONTRADO", 404],
    ["rateLimitExcedido", "RATE_LIMIT_EXCEDIDO", 429],
    ["erroInterno", "ERRO_INTERNO", 500],
    ["bancoIndisponivel", "BANCO_INDISPONIVEL", 503],
    ["migrationPendente", "MIGRATION_PENDENTE", 500],
  ] as const)("%s produz %s com status %i", (factory, code, status) => {
    const error = errors[factory]({ contexto: "teste" });

    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.details).toEqual({ contexto: "teste" });
  });

  it("integração aceita código INT_* e deriva o status", () => {
    const error = errors.integracao("INT_LIMITE_EXCEDIDO", { details: { provedor: "mercado" } });

    expect(error.code).toBe("INT_LIMITE_EXCEDIDO");
    expect(error.status).toBe(429);
    expect(error.details).toEqual({ provedor: "mercado" });
  });
});
