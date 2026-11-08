import DecimalJs from "decimal.js";

import { AppError } from "./errors";
import { err, ok, type Result } from "./result";

/**
 * Aritmética decimal (ADR-006): dinheiro, quantidade e percentual nunca
 * passam por `number`. `src/lib/**` não importa Prisma nem framework —
 * por isso o motor é `decimal.js` puro.
 *
 * Invariante de serialização: `toString()`/`toJSON()` sempre devolvem
 * string decimal com a escala conhecida (`"1234.50"`, nunca `1234.5`).
 */

const MAX_SCALE = 18;
const PRECISION = 40;

DecimalJs.set({
  precision: PRECISION,
  rounding: DecimalJs.ROUND_HALF_UP,
  // Impede notação científica na saída — o contrato é string decimal pura.
  toExpNeg: -30,
  toExpPos: 30,
});

export type DecimalInput = string | Decimal;

function clampScale(scale: number): number {
  return Math.min(Math.max(Math.trunc(scale), 0), MAX_SCALE);
}

/**
 * Escala = casas decimais do literal (preserva `"1234.50"` como 2 casas)
 * ou, na ausência de literal plano (ex.: `"1e-7"`), as casas do valor.
 */
function detectScale(text: string, value: DecimalJs): number {
  const literal = /\.(\d+)(?:[eE][+-]?\d+)?$/.exec(text);
  const literalScale = literal ? literal[1].length : 0;
  return clampScale(Math.max(literalScale, value.decimalPlaces()));
}

function invalidDecimal(cause?: unknown): AppError {
  return new AppError("VALIDACAO", { message: "Valor decimal inválido.", cause });
}

export class Decimal {
  private constructor(
    private readonly raw: DecimalJs,
    private readonly decimals: number,
  ) {}

  static from(input: DecimalInput): Decimal {
    if (input instanceof Decimal) {
      return input;
    }

    const text = typeof input === "string" ? input.trim() : "";
    if (text.length === 0) {
      throw invalidDecimal();
    }

    let raw: DecimalJs;
    try {
      raw = new DecimalJs(text);
    } catch (cause) {
      throw invalidDecimal(cause);
    }

    if (!raw.isFinite()) {
      throw invalidDecimal();
    }

    return new Decimal(raw, detectScale(text, raw));
  }

  /** Variante sem exceção, para uso em casos de uso que devolvem `Result`. */
  static parse(input: DecimalInput): Result<Decimal, AppError> {
    try {
      return ok(Decimal.from(input));
    } catch (error) {
      return err(error instanceof AppError ? error : invalidDecimal(error));
    }
  }

  static zero(scale = 0): Decimal {
    return new Decimal(new DecimalJs(0), clampScale(scale));
  }

  get scale(): number {
    return this.decimals;
  }

  add(other: DecimalInput): Decimal {
    const value = Decimal.from(other);
    return new Decimal(this.raw.plus(value.raw), clampScale(Math.max(this.decimals, value.decimals)));
  }

  sub(other: DecimalInput): Decimal {
    const value = Decimal.from(other);
    return new Decimal(this.raw.minus(value.raw), clampScale(Math.max(this.decimals, value.decimals)));
  }

  mul(other: DecimalInput): Decimal {
    const value = Decimal.from(other);
    const scale = clampScale(this.decimals + value.decimals);
    return new Decimal(this.raw.times(value.raw).toDecimalPlaces(scale, DecimalJs.ROUND_HALF_UP), scale);
  }

  div(other: DecimalInput, scale = this.decimals): Decimal {
    const value = Decimal.from(other);
    if (value.isZero()) {
      throw new AppError("VALIDACAO", { message: "Divisão por zero não é permitida." });
    }

    const digits = clampScale(scale);
    return new Decimal(this.raw.dividedBy(value.raw).toDecimalPlaces(digits, DecimalJs.ROUND_HALF_UP), digits);
  }

  round(scale = this.decimals): Decimal {
    const digits = clampScale(scale);
    return new Decimal(this.raw.toDecimalPlaces(digits, DecimalJs.ROUND_HALF_UP), digits);
  }

  neg(): Decimal {
    return new Decimal(this.raw.negated(), this.decimals);
  }

  abs(): Decimal {
    return new Decimal(this.raw.abs(), this.decimals);
  }

  /** -1, 0 ou 1. */
  compare(other: DecimalInput): -1 | 0 | 1 {
    const comparison = this.raw.comparedTo(Decimal.from(other).raw);
    if (comparison < 0) {
      return -1;
    }
    return comparison > 0 ? 1 : 0;
  }

  eq(other: DecimalInput): boolean {
    return this.raw.equals(Decimal.from(other).raw);
  }

  gt(other: DecimalInput): boolean {
    return this.raw.greaterThan(Decimal.from(other).raw);
  }

  gte(other: DecimalInput): boolean {
    return this.raw.greaterThanOrEqualTo(Decimal.from(other).raw);
  }

  lt(other: DecimalInput): boolean {
    return this.raw.lessThan(Decimal.from(other).raw);
  }

  lte(other: DecimalInput): boolean {
    return this.raw.lessThanOrEqualTo(Decimal.from(other).raw);
  }

  isZero(): boolean {
    return this.raw.isZero();
  }

  isNegative(): boolean {
    return this.raw.isNegative();
  }

  isPositive(): boolean {
    return this.raw.isPositive();
  }

  toFixed(scale = this.decimals): string {
    return this.raw.toFixed(clampScale(scale));
  }

  /** String decimal sem notação científica. */
  toString(): string {
    return this.toFixed(this.decimals);
  }

  /** Serialização JSON sempre como string (contrato de API §1). */
  toJSON(): string {
    return this.toString();
  }

  /** Conversão explícita — permitida apenas na borda de apresentação (ADR-006). */
  toNumber(): number {
    return this.raw.toNumber();
  }
}
