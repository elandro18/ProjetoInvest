/**
 * Regras de força de senha compartilhadas por cadastro e redefinição
 * (RN-071, RN-085; SECURITY.md §4).
 *
 * A checagem é de domínio: a borda não decide o que é senha fraca, para que
 * cadastro e redefinição nunca divirjam no critério.
 */

/** Hash de senha (Argon2id) injetado pela infraestrutura. */
export type HashSenha = (senha: string) => Promise<string>;

/** Senha mínima de 10 caracteres (SECURITY.md §4). */
export const SENHA_TAMANHO_MINIMO = 10;

/** Lista curta de senhas triviais; a checagem é case-insensitive. */
const SENHAS_COMUNS: ReadonlySet<string> = new Set([
  "1234567890",
  "12345678910",
  "qwertyuiop",
  "senha12345",
  "password123",
  "password1234",
  "administrador",
  "investimento",
  "minhasenha1",
  "abcd123456",
]);

export function senhaAceitavel(senha: string): boolean {
  return senha.length >= SENHA_TAMANHO_MINIMO && !SENHAS_COMUNS.has(senha.toLowerCase());
}
