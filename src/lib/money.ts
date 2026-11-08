import { Decimal, type DecimalInput } from "./decimal";

/**
 * Valor monetário em BRL (ADR-006, API_CONTRACTS.md §1).
 *
 * - escala fixa de 2 casas, arredondamento HALF_UP na última operação;
 * - nenhum cálculo passa por `number`;
 * - `toString()`/`toJSON()` devolvem string decimal (`"1234.50"`).
 */

export const MONEY_SCALE = 2;

export type MoneyInput = DecimalInput | Money;

function normalize(input: MoneyInput): Decimal {
  if (input instanceof Money) {
    return input.amount;
  }
  return Decimal.from(input);
}

export class Money {
  private constructor(private readonly value: Decimal) {}

  static from(input: MoneyInput): Money {
    return new Money(normalize(input).round(MONEY_SCALE));
  }

  static zero(): Money {
    return new Money(Decimal.zero(MONEY_SCALE));
  }

  /** Valor interno — use para persistir/formatar, não para cálculos diretos. */
  get amount(): Decimal {
    return this.value;
  }

  add(other: MoneyInput): Money {
    return new Money(this.value.add(normalize(other)));
  }

  subtract(other: MoneyInput): Money {
    return new Money(this.value.sub(normalize(other)));
  }

  multiplyBy(factor: DecimalInput): Money {
    return new Money(this.value.mul(factor).round(MONEY_SCALE));
  }

  negate(): Money {
    return new Money(this.value.neg());
  }

  abs(): Money {
    return new Money(this.value.abs());
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  equals(other: MoneyInput): boolean {
    return this.value.eq(normalize(other));
  }

  /** -1, 0 ou 1. */
  compare(other: MoneyInput): -1 | 0 | 1 {
    return this.value.compare(normalize(other));
  }

  toString(): string {
    return this.value.toFixed(MONEY_SCALE);
  }

  /** Serialização JSON sempre como string decimal com 2 casas. */
  toJSON(): string {
    return this.toString();
  }
}
