import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token opaco de uso único (RN-086, SECURITY.md §4).
 *
 * O valor puro (32 bytes aleatórios, base64url) só existe em memória e no
 * link enviado ao titular; no banco fica apenas o SHA-256 em hexadecimal.
 */

/** 32 bytes de entropia — link de verificação e de redefinição. */
const TAMANHO_TOKEN_BYTES = 32;

export interface TokenGerado {
  readonly token: string;
  readonly hash: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Gera o par (valor puro, hash a persistir). */
export function gerarToken(): TokenGerado {
  const token = randomBytes(TAMANHO_TOKEN_BYTES).toString("base64url");
  return { token, hash: hashToken(token) };
}

/**
 * Comparação em tempo constante entre dois hashes. O tamanho é o único
 * atributo que pode diferir sem custo — hashes SHA-256 têm sempre 64 chars.
 */
export function tokensIguais(hashA: string, hashB: string): boolean {
  const a = Buffer.from(hashA, "utf8");
  const b = Buffer.from(hashB, "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}
