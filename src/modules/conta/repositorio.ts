/**
 * Port de persistência de conta (ADR-004).
 *
 * O domínio nunca importa `@prisma/client`: estes tipos e o contrato são
 * implementados em `src/infra/db/conta-repositorio.ts`. As operações que
 * precisam ser atômicas (criação de conta + aceites + token, consumo do
 * token + ativação) são métodos únicos — a transação é responsabilidade da
 * implementação.
 */

export const STATUS_CONTA = ["PENDENTE_VERIFICACAO", "ATIVA", "SUSPENSA", "EXCLUIDA"] as const;

export type StatusConta = (typeof STATUS_CONTA)[number];

export const TIPO_TOKEN_CONTA = ["VERIFICACAO_EMAIL", "REDEFINICAO_SENHA"] as const;

export type TipoTokenConta = (typeof TIPO_TOKEN_CONTA)[number];

export const TIPO_ACEITE_LEGAL = ["TERMOS_USO", "POLITICA_PRIVACIDADE"] as const;

export type TipoAceiteLegal = (typeof TIPO_ACEITE_LEGAL)[number];

export interface ContaResumo {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly statusConta: StatusConta;
  readonly excluidoEm: Date | null;
}

export interface AceiteRegistro {
  readonly tipo: TipoAceiteLegal;
  readonly versao: string;
  readonly ipHash: string | null;
}

export interface TokenRegistro {
  readonly hash: string;
  readonly expiraEm: Date;
}

export interface NovaConta {
  readonly nome: string;
  readonly email: string;
  readonly senhaHash: string;
  readonly aceites: readonly AceiteRegistro[];
  readonly token: TokenRegistro;
}

export interface ContaCriada {
  readonly id: string;
  readonly email: string;
  readonly statusConta: StatusConta;
}

export interface TokenPersistido {
  readonly id: string;
  readonly usuarioId: string;
  readonly tipo: TipoTokenConta;
  readonly expiraEm: Date;
  readonly usadoEm: Date | null;
  readonly statusConta: StatusConta;
  readonly excluidoEm: Date | null;
}

export interface AtivacaoConta {
  readonly tokenId: string;
  readonly usuarioId: string;
  readonly agora: Date;
}

/** Violação de unicidade de e-mail (mesmo com caixa diferente). */
export class EmailJaCadastradoError extends Error {
  constructor() {
    super("E-mail já cadastrado.");
    this.name = "EmailJaCadastradoError";
  }
}

export interface ContaRepositorio {
  /** Busca case-insensitive pelo e-mail normalizado. */
  buscarPorEmail(email: string): Promise<ContaResumo | null>;

  /** Cria usuário, aceites e token de verificação numa única transação. */
  criar(conta: NovaConta): Promise<ContaCriada>;

  buscarTokenPorHash(hash: string): Promise<TokenPersistido | null>;

  /**
   * Consome o token (`usado_em`) e ativa a conta na mesma transação.
   * `null` quando o token já foi consumido concorrentemente.
   */
  ativarConta(ativacao: AtivacaoConta): Promise<{ emailVerificadoEm: Date } | null>;

  /** Invalida os tokens de verificação pendentes e emite o novo, atomicamente. */
  substituirTokenVerificacao(input: {
    readonly usuarioId: string;
    readonly token: TokenRegistro;
    readonly agora: Date;
  }): Promise<void>;
}
