import { describe, expect, it } from "vitest";

import { Decimal } from "./decimal";
import { AppError } from "./errors";

describe("Decimal.from", () => {
  it("aceita string decimal simples", () => {
    const value = Decimal.from("1234.50");

    expect(value.toString()).toBe("1234.50");
    expect(value.scale).toBe(2);
    expect(value.toNumber()).toBe(1234.5);
  });

  it("faz trim do literal antes de interpretar", () => {
    expect(Decimal.from("  10.00  ").toString()).toBe("10.00");
  });

  it("preserva a escala informada (3 casas continuam 3 casas)", () => {
    expect(Decimal.from("1.000").toString()).toBe("1.000");
    expect(Decimal.from("1.000").scale).toBe(3);
  });

  it("devolve a mesma instância quando já é Decimal", () => {
    const value = Decimal.from("1.10");

    expect(Decimal.from(value)).toBe(value);
  });

  it("interpreta notação científica sem perder as casas", () => {
    expect(Decimal.from("1e-7").toString()).toBe("0.0000001");
    expect(Decimal.from("1.5e-3").toString()).toBe("0.0015");
  });

  it("rejeita string vazia com VALIDACAO", () => {
    expect(() => Decimal.from("   ")).toThrowError(AppError);

    try {
      Decimal.from("");
    } catch (error) {
      expect((error as AppError).code).toBe("VALIDACAO");
    }
  });

  it("rejeita literal inválido com VALIDACAO", () => {
    try {
      Decimal.from("abc");
      expect.unreachable("deveria lançar");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe("VALIDACAO");
      expect((error as AppError).message).toBe("Valor decimal inválido.");
    }
  });

  it("rejeita valor não finito", () => {
    expect(() => Decimal.from("Infinity")).toThrowError(AppError);
  });
});

describe("Decimal.parse", () => {
  it("devolve ok para valor válido", () => {
    const result = Decimal.parse("10.25");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe("10.25");
    }
  });

  it("devolve err tipado para valor inválido", () => {
    const result = Decimal.parse("não é número");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDACAO");
    }
  });
});

describe("Decimal.zero", () => {
  it("cria zero com a escala pedida", () => {
    expect(Decimal.zero().toString()).toBe("0");
    expect(Decimal.zero(2).toString()).toBe("0.00");
  });

  it("limita a escala ao intervalo 0..18", () => {
    expect(Decimal.zero(-3).scale).toBe(0);
    expect(Decimal.zero(99).scale).toBe(18);
  });
});

describe("aritmética", () => {
  it("soma preservando a maior escala (G14)", () => {
    const sum = Decimal.from("0.1").add("0.2");

    expect(sum.toFixed(2)).toBe("0.30");
    expect(sum.eq("0.3")).toBe(true);
    expect(sum.toString()).toBe("0.3");
  });

  it("soma com escala diferente preserva a maior", () => {
    expect(Decimal.from("1.10").add("2.005").toString()).toBe("3.105");
  });

  it("subtrai preservando a escala", () => {
    expect(Decimal.from("10.00").sub("3.5").toString()).toBe("6.50");
  });

  it("multiplica e arredonda para a soma das escalas", () => {
    expect(Decimal.from("1.25").mul("2").toString()).toBe("2.50");
    expect(Decimal.from("10.00").mul("0.333").toString()).toBe("3.33000");
  });

  it("divide com a escala do dividendo por padrão", () => {
    expect(Decimal.from("10.00").div("4").toString()).toBe("2.50");
  });

  it("divide com escala explícita e arredondamento HALF_UP", () => {
    expect(Decimal.from("10").div("3", 4).toString()).toBe("3.3333");
  });

  it("rejeita divisão por zero com VALIDACAO", () => {
    try {
      Decimal.from("10.00").div("0");
      expect.unreachable("deveria lançar");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe("VALIDACAO");
      expect((error as AppError).message).toBe("Divisão por zero não é permitida.");
    }
  });

  it("arredonda HALF_UP", () => {
    expect(Decimal.from("2.345").round(2).toString()).toBe("2.35");
    expect(Decimal.from("2.344").round(2).toString()).toBe("2.34");
  });

  it("nega e calcula absoluto mantendo a escala", () => {
    expect(Decimal.from("10.50").neg().toString()).toBe("-10.50");
    expect(Decimal.from("-10.50").abs().toString()).toBe("10.50");
  });

  it("formata com escala explícita", () => {
    expect(Decimal.from("1.5").toFixed(4)).toBe("1.5000");
    expect(Decimal.from("1.5").toFixed(0)).toBe("2");
  });
});

describe("comparações", () => {
  it("compara devolvendo -1, 0 ou 1", () => {
    expect(Decimal.from("1").compare("2")).toBe(-1);
    expect(Decimal.from("2").compare("2.0")).toBe(0);
    expect(Decimal.from("3").compare("2")).toBe(1);
  });

  it("expõe eq/gt/gte/lt/lte", () => {
    const value = Decimal.from("10.00");

    expect(value.eq("10")).toBe(true);
    expect(value.gt("9.99")).toBe(true);
    expect(value.gte("10.00")).toBe(true);
    expect(value.lt("10.01")).toBe(true);
    expect(value.lte("10.00")).toBe(true);
  });

  it("identifica zero, negativo e positivo", () => {
    expect(Decimal.from("0.00").isZero()).toBe(true);
    expect(Decimal.from("-0.01").isNegative()).toBe(true);
    expect(Decimal.from("0.01").isPositive()).toBe(true);
    expect(Decimal.from("0.01").isNegative()).toBe(false);
  });
});

describe("serialização", () => {
  it("toJSON devolve string e JSON.stringify preserva a escala", () => {
    const value = Decimal.from("1234.50");

    expect(value.toJSON()).toBe("1234.50");
    expect(JSON.stringify({ valor: value })).toBe('{"valor":"1234.50"}');
  });

  it("nunca usa notação científica na saída", () => {
    expect(Decimal.from("0.0000001").toString()).toBe("0.0000001");
    expect(Decimal.from("100000000000000000000").toString()).toBe("100000000000000000000");
  });
});
