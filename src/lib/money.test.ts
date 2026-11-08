import { describe, expect, it } from "vitest";

import { Decimal } from "./decimal";
import { MONEY_SCALE, Money } from "./money";

describe("Money.from", () => {
  it("normaliza para 2 casas com arredondamento HALF_UP", () => {
    expect(Money.from("10.005").toString()).toBe("10.01");
    expect(Money.from("10.004").toString()).toBe("10.00");
    expect(MONEY_SCALE).toBe(2);
  });

  it("aceita outra instância de Money", () => {
    const original = Money.from("99.99");

    expect(Money.from(original).equals(original)).toBe(true);
  });

  it("aceita Decimal como entrada", () => {
    expect(Money.from(Decimal.from("5.555")).toString()).toBe("5.56");
  });

  it("cria zero com 2 casas", () => {
    expect(Money.zero().toString()).toBe("0.00");
    expect(Money.zero().isZero()).toBe(true);
  });
});

describe("aritmética monetária", () => {
  it("G14: 0,1 + 0,2 = 0,30 sem erro de ponto flutuante", () => {
    const total = Money.from("0.1").add("0.2");

    expect(total.toString()).toBe("0.30");
    expect(total.toJSON()).toBe("0.30");
    expect(total.equals("0.30")).toBe(true);
  });

  it("soma mantendo 2 casas", () => {
    expect(Money.from("1234.50").add("10.25").toString()).toBe("1244.75");
  });

  it("subtrai mantendo 2 casas", () => {
    expect(Money.from("1234.50").subtract("34.50").toString()).toBe("1200.00");
  });

  it("multiplica por fator e arredonda para 2 casas", () => {
    expect(Money.from("100.00").multiplyBy("0.333").toString()).toBe("33.30");
  });

  it("nega e calcula absoluto", () => {
    expect(Money.from("10.00").negate().toString()).toBe("-10.00");
    expect(Money.from("-10.00").abs().toString()).toBe("10.00");
  });

  it("identifica zero e negativo", () => {
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.from("-0.01").isNegative()).toBe(true);
    expect(Money.from("0.01").isNegative()).toBe(false);
  });

  it("compara e iguala valores", () => {
    const value = Money.from("10.00");

    expect(value.equals("10")).toBe(true);
    expect(value.equals(Money.from("10.00"))).toBe(true);
    expect(value.compare("9.99")).toBe(1);
    expect(value.compare("10.01")).toBe(-1);
    expect(value.compare("10.00")).toBe(0);
  });
});

describe("serialização monetária", () => {
  it("toString e toJSON sempre devolvem string com 2 casas", () => {
    const value = Money.from("1234.5");

    expect(value.toString()).toBe("1234.50");
    expect(JSON.stringify({ total: value })).toBe('{"total":"1234.50"}');
  });

  it("expõe o Decimal interno para persistência controlada", () => {
    expect(Money.from("10.00").amount).toBeInstanceOf(Decimal);
    expect(Money.from("10.00").amount.toString()).toBe("10.00");
  });
});
