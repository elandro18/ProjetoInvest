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
  | "AUTH_EMAIL_JA_CADASTRADO"
  | "AUTH_SENHA_FRACA"
  | "AUTH_ACEITE_OBRIGATORIO"
  | "AUTH_VERSAO_TERMOS_DESATUALIZADA"
  | "AUTH_CREDENCIAIS_INVALIDAS"
  | "AUTH_EMAIL_NAO_VERIFICADO"
  | "AUTH_CONTA_SUSPENSA"
  | "AUTH_TOKEN_INVALIDO"
  | "AUTH_TOKEN_EXPIRADO"
  | "AUTH_TOKEN_JA_USADO"
  | "CONTA_EXCLUSAO_BLOQUEADA"
  | "ATIVO_NAO_ENCONTRADO"
  | "ATIVO_TICKER_DUPLICADO"
  | "ATIVO_TICKER_INVALIDO"
  | "ATIVO_SEGMENTO_OBRIGATORIO"
  | "ATIVO_SEGMENTO_INVALIDO"
  | "ATIVO_CLASSE_INVALIDA"
  | "ATIVO_CNPJ_INVALIDO"
  | "ATIVO_CLASSE_IMUTAVEL"
  | "RF_NAO_ENCONTRADA"
  | "RF_VENCIMENTO_INVALIDO"
  | "RF_TAXA_INVALIDA"
  | "RF_SALDO_INVALIDO"
  | "RF_CAMPO_IMUTAVEL"
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
  AUTH_EMAIL_JA_CADASTRADO: { status: 409, message: "Este e-mail já está cadastrado." },
  AUTH_SENHA_FRACA: { status: 422, message: "A senha não atende aos requisitos mínimos." },
  AUTH_ACEITE_OBRIGATORIO: {
    status: 422,
    message: "É necessário aceitar os termos e a política de privacidade.",
  },
  AUTH_VERSAO_TERMOS_DESATUALIZADA: {
    status: 422,
    message: "Os termos foram atualizados. Revise e aceite novamente.",
  },
  AUTH_CREDENCIAIS_INVALIDAS: { status: 401, message: "E-mail ou senha inválidos." },
  AUTH_EMAIL_NAO_VERIFICADO: { status: 403, message: "Confirme seu e-mail para entrar." },
  AUTH_CONTA_SUSPENSA: { status: 403, message: "Conta suspensa. Fale com o suporte." },
  AUTH_TOKEN_INVALIDO: { status: 400, message: "Link inválido." },
  AUTH_TOKEN_EXPIRADO: { status: 410, message: "Este link expirou." },
  AUTH_TOKEN_JA_USADO: { status: 409, message: "Este link já foi utilizado." },
  CONTA_EXCLUSAO_BLOQUEADA: {
    status: 409,
    message: "Não é possível encerrar a conta agora.",
  },
  ATIVO_NAO_ENCONTRADO: { status: 404, message: "Ativo não encontrado." },
  ATIVO_TICKER_DUPLICADO: {
    status: 409,
    message: "Já existe um ativo com este ticker.",
  },
  ATIVO_TICKER_INVALIDO: {
    status: 422,
    message: "Ticker inválido. Use de 4 a 20 caracteres alfanuméricos.",
  },
  ATIVO_SEGMENTO_OBRIGATORIO: {
    status: 422,
    message: "Informe o segmento para um FII.",
  },
  ATIVO_SEGMENTO_INVALIDO: {
    status: 422,
    message: "Segmento não pertence à classe informada.",
  },
  ATIVO_CLASSE_INVALIDA: {
    status: 422,
    message: "Classe de ativo inválida ou inativa.",
  },
  ATIVO_CNPJ_INVALIDO: { status: 422, message: "CNPJ inválido." },
  ATIVO_CLASSE_IMUTAVEL: {
    status: 422,
    message: "A classe não pode ser alterada após movimentações.",
  },
  RF_NAO_ENCONTRADA: { status: 404, message: "Investimento não encontrado." },
  RF_VENCIMENTO_INVALIDO: {
    status: 422,
    message: "O vencimento deve ser posterior à aplicação.",
  },
  RF_TAXA_INVALIDA: { status: 422, message: "Taxa inválida." },
  RF_SALDO_INVALIDO: { status: 422, message: "Saldo atual inválido." },
  RF_CAMPO_IMUTAVEL: {
    status: 422,
    message: "Produto, indexador e data de aplicação não podem ser alterados.",
  },
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

  authEmailJaCadastrado(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_EMAIL_JA_CADASTRADO", { details });
  },

  authSenhaFraca(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_SENHA_FRACA", { details });
  },

  authAceiteObrigatorio(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_ACEITE_OBRIGATORIO", { details });
  },

  authVersaoTermosDesatualizada(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_VERSAO_TERMOS_DESATUALIZADA", { details });
  },

  authCredenciaisInvalidas(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_CREDENCIAIS_INVALIDAS", { details });
  },

  authEmailNaoVerificado(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_EMAIL_NAO_VERIFICADO", { details });
  },

  authContaSuspensa(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_CONTA_SUSPENSA", { details });
  },

  authTokenInvalido(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_TOKEN_INVALIDO", { details });
  },

  authTokenExpirado(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_TOKEN_EXPIRADO", { details });
  },

  authTokenJaUsado(details?: AppErrorDetails): AppError {
    return new AppError("AUTH_TOKEN_JA_USADO", { details });
  },

  contaExclusaoBloqueada(details?: AppErrorDetails): AppError {
    return new AppError("CONTA_EXCLUSAO_BLOQUEADA", { details });
  },

  ativoNaoEncontrado(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_NAO_ENCONTRADO", { details });
  },

  ativoTickerDuplicado(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_TICKER_DUPLICADO", { details });
  },

  ativoTickerInvalido(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_TICKER_INVALIDO", { details });
  },

  ativoSegmentoObrigatorio(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_SEGMENTO_OBRIGATORIO", { details });
  },

  ativoSegmentoInvalido(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_SEGMENTO_INVALIDO", { details });
  },

  ativoClasseInvalida(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_CLASSE_INVALIDA", { details });
  },

  ativoCnpjInvalido(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_CNPJ_INVALIDO", { details });
  },

  ativoClasseImutavel(details?: AppErrorDetails): AppError {
    return new AppError("ATIVO_CLASSE_IMUTAVEL", { details });
  },

  rfNaoEncontrada(details?: AppErrorDetails): AppError {
    return new AppError("RF_NAO_ENCONTRADA", { details });
  },

  rfVencimentoInvalido(details?: AppErrorDetails): AppError {
    return new AppError("RF_VENCIMENTO_INVALIDO", { details });
  },

  rfTaxaInvalida(details?: AppErrorDetails): AppError {
    return new AppError("RF_TAXA_INVALIDA", { details });
  },

  rfSaldoInvalido(details?: AppErrorDetails): AppError {
    return new AppError("RF_SALDO_INVALIDO", { details });
  },

  rfCampoImutavel(details?: AppErrorDetails): AppError {
    return new AppError("RF_CAMPO_IMUTAVEL", { details });
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
