import { describe, expect, it } from "vitest";

import { CAPACIDADES, STATUS_DADO, isCapacidade } from "./provedor";

describe("CAPACIDADES", () => {
  it("declara as capacidades do contrato de provedores", () => {
    expect([...CAPACIDADES]).toEqual([
      "cadastro",
      "cotacao",
      "historico-preco",
      "dividendos",
      "indicadores",
      "informes",
      "composicao",
      "renda-fixa",
    ]);
  });
});

describe("STATUS_DADO", () => {
  it("declara os status de proveniência do dado", () => {
    expect([...STATUS_DADO]).toEqual([
      "OFICIAL",
      "MERCADO",
      "ESTIMADO",
      "HISTORICO",
      "INDISPONIVEL",
    ]);
  });
});

describe("isCapacidade", () => {
  it.each([...CAPACIDADES])("reconhece %s", (capacidade) => {
    expect(isCapacidade(capacidade)).toBe(true);
  });

  it("rejeita string fora do contrato", () => {
    expect(isCapacidade("opcao")).toBe(false);
    expect(isCapacidade("")).toBe(false);
  });

  it("rejeita valor que não é string", () => {
    expect(isCapacidade(null)).toBe(false);
    expect(isCapacidade(10)).toBe(false);
    expect(isCapacidade({ capacidade: "cotacao" })).toBe(false);
  });
});
