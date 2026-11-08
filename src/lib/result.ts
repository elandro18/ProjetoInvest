import type { AppError } from "./errors";

/**
 * Resultado explícito de uma operação de domínio (RN-072 / ADR-004).
 *
 * O domínio devolve `Result` em vez de lançar exceção: o erro é um valor
 * tipado, mapeado para HTTP apenas na borda (`src/infra/http`).
 */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };

/** Sucesso. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Falha com erro tipado (por padrão, `AppError`). */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Valor em caso de sucesso; `fallback` em caso de erro. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
