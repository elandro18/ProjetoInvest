import { describe, expect, it } from "vitest";

import { Decimal } from "../../lib/decimal";
import { calcularDistribuicao, type LinhaMetaAporte } from "./motor";

/**
 * Testes do motor de priorização (RN-025-2, RN-026, RN-027, RN-054).
 *
 * Cobrem water-filling por gap, desempate por código, carteira vazia, classes
 * na meta, soma exata após arredondamento e distribuição dos segmentos dentro
 * da parcela de FII. Nenhum banco é tocado.
 */

function linha(
  codigo: string,
  valorAtual: string,
  percentualMeta: string,
  nome = codigo,
): LinhaMetaAporte {
  return { codigo, nome, valorAtual, percentualMeta };
}

function soma(linhas: readonly { readonly valor: string }[]): string {
  return linhas
    .reduce((total, item) => total.add(Decimal.from(item.valor)), Decimal.zero(2))
    .toFixed(2);
}

function valorDe(linhas: readonly { readonly codigo: string; readonly valor: string }[], codigo: string): string {
  return linhas.find((item) => item.codigo === codigo)?.valor ?? "ausente";
}

describe("calcularDistribuicao — classes", () => {
  it("direciona 100% para a única classe abaixo da meta (não divide 50/50)", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "3500.00", "50.000000", "Renda Fixa"),
        linha("FII", "6500.00", "50.000000", "Fundos Imobiliários"),
      ],
      segmentos: [],
    });

    expect(resultado.totalPosAporte).toBe("11000.00");
    expect(valorDe(resultado.classes, "RENDA_FIXA")).toBe("1000.00");
    expect(valorDe(resultado.classes, "FII")).toBe("0.00");

    const rendaFixa = resultado.classes.find((item) => item.codigo === "RENDA_FIXA");
    expect(rendaFixa?.justificativa).toContain("abaixo da meta");
    expect(rendaFixa?.justificativa).toContain("R$ 1.000,00");

    const fii = resultado.classes.find((item) => item.codigo === "FII");
    expect(fii?.justificativa).toContain("acima da meta");
    expect(fii?.justificativa).toContain("não recebe aporte");
  });

  it("divide 50/50 na carteira vazia com metas iguais", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "0.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "0.00", "50.000000", "Renda Fixa"),
        linha("FII", "0.00", "50.000000", "Fundos Imobiliários"),
      ],
      segmentos: [],
    });

    expect(valorDe(resultado.classes, "RENDA_FIXA")).toBe("500.00");
    expect(valorDe(resultado.classes, "FII")).toBe("500.00");
  });

  it("preenche primeiro o maior gap quando as metas não são iguais", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "0.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "0.00", "40.000000", "Renda Fixa"),
        linha("FII", "0.00", "60.000000", "Fundos Imobiliários"),
      ],
      segmentos: [],
    });

    expect(valorDe(resultado.classes, "FII")).toBe("600.00");
    expect(valorDe(resultado.classes, "RENDA_FIXA")).toBe("400.00");
  });

  it("distribui pela proporção das metas quando os gaps das classes são iguais", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "2000.00",
      classes: [
        linha("RENDA_FIXA", "5000.00", "50.000000", "Renda Fixa"),
        linha("FII", "5000.00", "50.000000", "Fundos Imobiliários"),
      ],
      segmentos: [],
    });

    expect(valorDe(resultado.classes, "RENDA_FIXA")).toBe("1000.00");
    expect(valorDe(resultado.classes, "FII")).toBe("1000.00");
    expect(resultado.classes.every((item) => item.justificativa.includes("abaixo da meta"))).toBe(true);
  });

  it("explica a classe exatamente na meta quando ela não recebe aporte", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "2000.00",
      classes: [
        linha("RENDA_FIXA", "6000.00", "50.000000", "Renda Fixa"),
        linha("FII", "4000.00", "50.000000", "Fundos Imobiliários"),
      ],
      segmentos: [],
    });

    expect(valorDe(resultado.classes, "RENDA_FIXA")).toBe("0.00");
    expect(valorDe(resultado.classes, "FII")).toBe("2000.00");
    const rendaFixa = resultado.classes.find((item) => item.codigo === "RENDA_FIXA");
    expect(rendaFixa?.justificativa).toContain("está na meta");
    expect(rendaFixa?.justificativa).toContain("não recebe aporte");
  });

  it("arredonda em 2 casas e devolve o resíduo à maior linha (soma exata)", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "0.00",
      valorAporte: "1000.01",
      classes: [
        linha("CLASSE_A", "0.00", "33.333333"),
        linha("CLASSE_B", "0.00", "33.333333"),
        linha("CLASSE_C", "0.00", "33.333334"),
      ],
      segmentos: [],
    });

    expect(soma(resultado.classes)).toBe("1000.01");
  });

  it("defende-se de metas zeradas distribuindo igualmente", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "0.00",
      valorAporte: "100.00",
      classes: [linha("A", "0.00", "0.000000"), linha("B", "0.00", "0.000000")],
      segmentos: [],
    });

    expect(soma(resultado.classes)).toBe("100.00");
    expect(valorDe(resultado.classes, "A")).toBe("50.00");
    expect(valorDe(resultado.classes, "B")).toBe("50.00");
  });

  it("devolve lista vazia quando não há classes", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "0.00",
      valorAporte: "100.00",
      classes: [],
      segmentos: [],
    });

    expect(resultado.classes).toEqual([]);
    expect(resultado.valorFii).toBe("0.00");
  });
});

describe("calcularDistribuicao — segmentos", () => {
  const SEGMENTOS_NA_META: readonly LinhaMetaAporte[] = [
    linha("LOGISTICA", "2750.00", "25.000000", "Logística"),
    linha("SHOPPING", "1650.00", "15.000000", "Shopping Centers"),
    linha("RECEBIVEIS", "2750.00", "25.000000", "Recebíveis Imobiliários"),
    linha("LAJES", "1100.00", "10.000000", "Lajes Corporativas"),
    linha("AGRO", "550.00", "5.000000", "Agronegócio"),
    linha("CAIXA_OPORTUNIDADES", "550.00", "5.000000", "Caixa e Oportunidades"),
    linha("RENDA_URBANA", "825.00", "7.500000", "Renda Urbana"),
    linha("HIBRIDO", "825.00", "7.500000", "Híbridos"),
  ];

  it("distribui os segmentos dentro da parcela de FII priorizando o maior gap", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "4450.00", "45.000000", "Renda Fixa"),
        linha("FII", "5550.00", "55.000000", "Fundos Imobiliários"),
      ],
      segmentos: [
        linha("LOGISTICA", "0.00", "25.000000", "Logística"),
        linha("SHOPPING", "0.00", "15.000000", "Shopping Centers"),
        linha("RECEBIVEIS", "0.00", "25.000000", "Recebíveis Imobiliários"),
        linha("LAJES", "0.00", "10.000000", "Lajes Corporativas"),
        linha("AGRO", "0.00", "5.000000", "Agronegócio"),
        linha("CAIXA_OPORTUNIDADES", "0.00", "5.000000", "Caixa e Oportunidades"),
        linha("RENDA_URBANA", "0.00", "7.500000", "Renda Urbana"),
        linha("HIBRIDO", "0.00", "7.500000", "Híbridos"),
      ],
    });

    expect(resultado.valorFii).toBe("500.00");
    expect(soma(resultado.segmentos)).toBe("500.00");
    expect(valorDe(resultado.segmentos, "LOGISTICA")).toBe("500.00");
  });

  it("distribui os segmentos pela proporção da meta quando não há gap positivo", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "4450.00", "45.000000", "Renda Fixa"),
        linha("FII", "5550.00", "55.000000", "Fundos Imobiliários"),
      ],
      segmentos: SEGMENTOS_NA_META,
    });

    expect(resultado.valorFii).toBe("500.00");
    expect(soma(resultado.segmentos)).toBe("500.00");
    expect(valorDe(resultado.segmentos, "LOGISTICA")).toBe("125.00");
    expect(valorDe(resultado.segmentos, "SHOPPING")).toBe("75.00");
    expect(valorDe(resultado.segmentos, "RENDA_URBANA")).toBe("37.50");
  });

  it("zera todos os segmentos quando a classe de FII não recebe aporte", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "1000.00", "90.000000", "Renda Fixa"),
        linha("FII", "9000.00", "10.000000", "Fundos Imobiliários"),
      ],
      segmentos: SEGMENTOS_NA_META,
    });

    expect(resultado.valorFii).toBe("0.00");
    expect(resultado.segmentos.every((item) => item.valor === "0.00")).toBe(true);
    expect(soma(resultado.segmentos)).toBe("0.00");
  });

  it("respeita o código de classe de FII configurado", () => {
    const resultado = calcularDistribuicao({
      totalAtual: "10000.00",
      valorAporte: "1000.00",
      classes: [
        linha("RENDA_FIXA", "4450.00", "45.000000", "Renda Fixa"),
        linha("FUNDO_IMOBILIARIO", "5550.00", "55.000000", "FII"),
      ],
      segmentos: SEGMENTOS_NA_META,
      codigoClasseFii: "FUNDO_IMOBILIARIO",
    });

    expect(resultado.valorFii).toBe("500.00");
    expect(soma(resultado.segmentos)).toBe("500.00");
  });
});
