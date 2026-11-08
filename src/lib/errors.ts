/**
 * Erro de aplicação com código do catálogo público (ERROR_CATALOG.md §1–§2).
 *
 * Regras do catálogo respeitadas aqui:
 * - o código é o contrato público e nunca muda de significado;
 * - `message` é PT-BR, orientada à ação e sem detalhe interno;
 * - `details` nunca carrega token, senha ou chave;
 * - o status HTTP é derivado do código, nunca escolhido pelo chamador.
 */

export type AppErrorCode =
  | "VALIDACAO"
  | "REQUISICAO_MALFORMADA"
  | "NAO_AUTENTICADO"
  | "AUTH_SESSAO_EXPIRADA"
  | "SEM_PERMISSAO"
  | "RECURSO_NAO_ENCONTRADO"
  | "RATE_LIMIT_EXCEDIDO"
  | "ERRO_INTERNO"
  | "BANCO_INDISPONIVEL"
  | "MIGRATION_PENDENTE"
  | "INT_PROVEDOR_INDISPONIVEL"
  | "INT_TIMEOUT"
  | "INT_LIMITE_EXCEDIDO"
  | "INT_RESPOSTA_INVALIDA"
  | "INT_OPERACAO_NAO_SUPORTADA"
  | "INT_FALHA_AUTENTICACAO_PROVEDOR"
  | "INT_ATIVO_NAO_ENCONTRADO"
  | "INT_DADOS_INCOMPLETOS";

/** Códigos de integração externa (ERROR_CATALOG.md §10). */
export type IntegrationErrorCode = Extract<AppErrorCode, `INT_${string}`>;

export type HttpStatus =
  | 206
  | 400
  | 401
  | 403
  | 404
  | 409
  | 410
  | 422
  | 429
  | 500
  | 502
  | 503
  | 504;

export interface ErrorCatalogEntry {
  readonly status: HttpStatus;
  readonly message: string;
}

/** Espelho de `specs/ERROR_CATALOG.md` §2. */
export const ERROR_CATALOG: Readonly<Record<AppErrorCode, ErrorCatalogEntry>> = {
  VALIDACAO: { status: 422, message: "Um ou mais campos são inválidos." },
  REQUISICAO_MALFORMADA: { status: 400, message: "Requisição inválida." },
  NAO_AUTENTICADO: { status: 401, message: "Sessão necessária." },
  AUTH_SESSAO_EXPIRADA: { status: 401, message: "Sua sessão expirou. Entre novamente." },
  SEM_PERMISSAO: { status: 403, message: "Você não tem permissão para esta operação." },
  RECURSO_NAO_ENCONTRADO: { status: 404, message: "Recurso não encontrado." },
  RATE_LIMIT_EXCEDIDO: { status: 429, message: "Muitas tentativas. Aguarde e tente novamente." },
  ERRO_INTERNO: { status: 500, message: "Erro inesperado. Tente novamente." },
  BANCO_INDISPONIVEL: { status: 503, message: "Serviço temporariamente indisponível." },
  MIGRATION_PENDENTE: { status: 500, message: "Serviço em atualização." },
  INT_PROVEDOR_INDISPONIVEL: {
    status: 503,
    message: "Fonte de dados indisponível. Exibindo dados armazenados.",
  },
  INT_TIMEOUT: { status: 504, message: "A fonte de dados não respondeu a tempo." },
  INT_LIMITE_EXCEDIDO: { status: 429, message: "Limite de consultas da fonte atingido." },
  INT_RESPOSTA_INVALIDA: { status: 502, message: "A fonte retornou dados inválidos." },
  INT_OPERACAO_NAO_SUPORTADA: { status: 422, message: "Operação não disponível nesta fonte." },
  INT_FALHA_AUTENTICACAO_PROVEDOR: {
    status: 502,
    message: "Falha de autenticação com a fonte de dados.",
  },
  INT_ATIVO_NAO_ENCONTRADO: { status: 404, message: "Ativo não encontrado na fonte consultada." },
  INT_DADOS_INCOMPLETOS: { status: 206, message: "Resposta parcial da fonte." },
};

/** Item de erro por campo (RN-069). */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

/** Dados de apoio do envelope de erro — nunca contém segredo. */
export type AppErrorDetails = Record<string, unknown>;

export interface AppErrorOptions {
  /** Sobrescreve a mensagem padrão do catálogo (continua sendo PT-BR, sem detalhe interno). */
  message?: string;
  details?: AppErrorDetails;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: HttpStatus;
  readonly details?: AppErrorDetails;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    const entry = ERROR_CATALOG[code];
    super(options.message ?? entry.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = entry.status;
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }

  static isAppError(value: unknown): value is AppError {
    return value instanceof AppError;
  }

  /** Serialização segura: nunca expõe `stack` nem a causa. */
  toJSON(): { code: AppErrorCode; message: string; details?: AppErrorDetails } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/** Factory genérica — prefira as factories nomeadas abaixo. */
export function appError(code: AppErrorCode, options: AppErrorOptions = {}): AppError {
  return new AppError(code, options);
}

/**
 * Factories por código do catálogo (§2). Cada uma fixa o status HTTP.
 */
export const errors = {
  validacao(fieldErrors: readonly FieldError[], message?: string): AppError {
    return new AppError("VALIDACAO", { message, details: { errors: [...fieldErrors] } });
  },

  requisicaoMalformada(details?: AppErrorDetails): AppError {
    return new AppError("REQUISICAO_MALFORMADA", { details });
  },

  naoAutenticado(details?: AppErrorDetails): AppError {
    return new AppError("NAO_AUTENTICADO", { details });
  },

  authSessaoExpirada(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_SESSAO_EXPIRADA", { details });
  },

  semPermissao(details?: AppErrorDetails): AppError {
    return new AppError("SEM_PERMISSAO", { details });
  },

  recursoNaoEncontrado(details?: AppErrorDetails): AppError {
    return new AppError("RECURSO_NAO_ENCONTRADO", { details });
  },

  rateLimitExcedido(details?: AppErrorDetails): AppError {
    return new AppError("RATE_LIMIT_EXCEDIDO", { details });
  },

  erroInterno(details?: AppErrorDetails): AppError {
    return new AppError("ERRO_INTERNO", { details });
  },

  bancoIndisponivel(details?: AppErrorDetails): AppError {
    return new AppError("BANCO_INDISPONIVEL", { details });
  },

  migrationPendente(details?: AppErrorDetails): AppError {
    return new AppError("MIGRATION_PENDENTE", { details });
  },

  /** Erro de integração externa (ERROR_CATALOG.md §10). */
  integracao(code: IntegrationErrorCode, options: AppErrorOptions = {}): AppError {
    return new AppError(code, options);
  },
} as const;
