import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";

/**
 * Hash de senha em Argon2id (RN-071, SECURITY.md §4).
 *
 * Parâmetros: 64 MB de memória, 3 iterações, paralelismo 1. O salt é gerado
 * pela biblioteca por hash; o valor devolvido é a string PHC completa e nunca
 * sai da camada de persistência.
 */

// `Algorithm` é `const enum`; com `isolatedModules` os membros não podem ser
// acessados, então o código numérico de Argon2id (2) é fixado aqui.
const ALGORITMO_ARGON2ID = 2 as Algorithm;

export const PARAMETROS_ARGON2ID = {
  algorithm: ALGORITMO_ARGON2ID,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashSenha(senha: string): Promise<string> {
  return hash(senha, PARAMETROS_ARGON2ID);
}

/**
 * Confere a senha contra o hash persistido. Hash corrompido ou de formato
 * desconhecido equivale a senha incorreta — nunca propaga o erro da biblioteca.
 */
export async function verificarSenha(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    return false;
  }
}
