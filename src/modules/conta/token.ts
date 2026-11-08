/**
 * Tipos de token opaco do lado do domínio (RN-086).
 *
 * O valor puro só existe em memória; o que trafega para a persistência é o
 * hash. A validade é decidida aqui — a infraestrutura apenas grava `expiraEm`.
 */

export interface TokenGerado {
  readonly token: string;
  readonly hash: string;
}

export type GerarToken = () => TokenGerado;

export type HashToken = (token: string) => string;

/** Verificação de e-mail: 24 h (SECURITY.md §4). */
export const VALIDADE_VERIFICACAO_EMAIL_MS = 24 * 60 * 60 * 1000;

/** Redefinição de senha: 1 h (RN-086, SECURITY.md §4). */
export const VALIDADE_REDEFINICAO_SENHA_MS = 60 * 60 * 1000;

export function calcularExpiracao(agora: Date, validadeMs: number): Date {
  return new Date(agora.getTime() + validadeMs);
}
