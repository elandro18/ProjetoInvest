import { describe, expect, it } from "vitest";

import {
  classificarDesvio,
  descreverMeta,
  distribuicaoVazia,
  dividendosVisiveis,
  erroDoBloco,
  evolucaoPatrimonialVazia,
  evolucaoRendimentosVazia,
  formatarData,
  formatarDesvioPontos,
  formatarMes,
  formatarMoeda,
  formatarPercentual,
  larguraDaBarra,
  linhasMeta,
  posicaoDaMarca,
  rotuloMes,
  substituirErroDoBloco,
  type DividendoApi,
  type IndicadoresApi,
} from "./dashboard-ui";
import { Decimal } from "@/src/lib/decimal";

const INDICADORES: IndicadoresApi = {
  vazio: false,
  patrimonioTotal: "152340.00",
  totalInvestido: "140000.00",
  valorAtual: "152340.00",
  resultadoAcumulado: "19680.00",
  rendaMensal: "820.00",
  rendimentosAno: "7340.00",
  percentualRendaFixa: "40.041000",
  percentualFiis: "59.959000",
  meta: [],
};

describe("dashboard-ui — formatação", () => {
  it("formata dinheiro, percentual e desvio a partir da string decimal", () => {
    expect(formatarMoeda("152340.00")).toBe("R$ 152.340,00");
    expect(formatarMoeda("-1234.5")).toBe("-R$ 1.234,50");
    expect(formatarMoeda("inválido")).toBe("Indisponível");
    expect(formatarPercentual("40.041000")).toBe("40,0%");
    expect(formatarPercentual("40.041000", 2)).toBe("40,04%");
    expect(formatarDesvioPontos("-9.959000")).toBe("−10,0 p.p.");
    expect(formatarDesvioPontos("9.959000")).toBe("+10,0 p.p.");
    expect(formatarDesvioPontos("0.000000")).toBe("0,0 p.p.");
  });

  it("formata datas e meses sem depender de fuso", () => {
    expect(formatarData("2026-01-15")).toBe("15/01/2026");
    expect(formatarData("15/01/2026")).toBe("Data inválida");
    expect(rotuloMes("2026-01")).toBe("jan/26");
    expect(rotuloMes("inválido")).toBe("inválido");
    expect(formatarMes("2026-01")).toBe("01/2026");
  });
});

describe("dashboard-ui — comparação com a meta", () => {
  it("usa o padrão 50/50 quando o titular ainda não configurou metas", () => {
    const linhas = linhasMeta(INDICADORES);

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      codigo: "RENDA_FIXA",
      meta: "50.000000",
      situacao: "ABAIXO",
    });
    expect(linhas[0]?.desvio).toBe("-9.959000");
    expect(linhas[1]).toMatchObject({ codigo: "FII", situacao: "ACIMA" });
  });

  it("reaproveita a meta do servidor quando existe", () => {
    const linhas = linhasMeta({
      ...INDICADORES,
      meta: [
        {
          codigo: "RENDA_FIXA",
          atual: "52.000000",
          meta: "50.000000",
          desvio: "2.000000",
          situacao: "ACIMA",
        },
      ],
    });

    expect(linhas).toEqual([
      {
        codigo: "RENDA_FIXA",
        rotulo: "Renda fixa",
        atual: "52.000000",
        meta: "50.000000",
        desvio: "2.000000",
        situacao: "ACIMA",
      },
    ]);
    expect(descreverMeta(linhas[0]!)).toBe("Renda fixa 52,0% · meta 50,0% · +2,0 p.p.");
  });

  it("classifica com a tolerância de 0,5 p.p.", () => {
    expect(classificarDesvio(Decimal.from("0.5"))).toBe("DENTRO");
    expect(classificarDesvio(Decimal.from("-0.5"))).toBe("DENTRO");
    expect(classificarDesvio(Decimal.from("0.51"))).toBe("ACIMA");
    expect(classificarDesvio(Decimal.from("-0.51"))).toBe("ABAIXO");
  });

  it("posiciona a marca e a barra entre 0 e 100", () => {
    expect(posicaoDaMarca("50.000000")).toBe(50);
    expect(posicaoDaMarca("-10")).toBe(0);
    expect(posicaoDaMarca("120")).toBe(100);
    expect(larguraDaBarra("40.041000")).toBe(40.04);
    expect(larguraDaBarra("inválido")).toBe(0);
  });
});

describe("dashboard-ui — séries", () => {
  it("detecta distribuições e evoluções vazias", () => {
    expect(distribuicaoVazia([])).toBe(true);
    expect(
      distribuicaoVazia([
        {
          codigo: "FII",
          nome: "FII",
          valor: "0.00",
          percentual: "0.000000",
          valorIndisponivel: true,
        },
      ]),
    ).toBe(true);
    expect(evolucaoPatrimonialVazia([])).toBe(true);
    expect(
      evolucaoPatrimonialVazia([
        { data: "2026-01-01", patrimonio: "0.00", rendaFixa: "0", fiis: "0" },
      ]),
    ).toBe(true);
    expect(evolucaoRendimentosVazia([{ mes: "2026-01", valor: "0.00" }])).toBe(true);
    expect(evolucaoRendimentosVazia([{ mes: "2026-01", valor: "10.00" }])).toBe(false);
  });

  it("limita os dividendos aos 12 mais recentes", () => {
    const dividendos: DividendoApi[] = Array.from({ length: 15 }, (_, indice) => ({
      data: `2026-01-${String(indice + 1).padStart(2, "0")}`,
      ativo: `FII${indice}`,
      valor: "10.00",
    }));

    const visiveis = dividendosVisiveis(dividendos);

    expect(visiveis).toHaveLength(12);
    expect(visiveis[0]?.data).toBe("2026-01-15");
    expect(visiveis[11]?.data).toBe("2026-01-04");
  });
});

describe("dashboard-ui — erros por bloco", () => {
  const erros = [
    { bloco: "graficos" as const, code: "ERRO_INTERNO", message: "Falhou" },
    { bloco: "oportunidades" as const, code: "ERRO_INTERNO", message: "Falhou" },
  ];

  it("localiza e substitui o erro de um bloco sem tocar nos demais", () => {
    expect(erroDoBloco(erros, "graficos")).toEqual(erros[0]);

    const substituidos = substituirErroDoBloco(erros, "graficos", {
      bloco: "graficos",
      code: "ERRO_REDE",
      message: "Sem conexão",
    });
    expect(substituidos).toHaveLength(2);
    expect(erroDoBloco(substituidos, "graficos")?.code).toBe("ERRO_REDE");
    expect(erroDoBloco(substituidos, "oportunidades")?.code).toBe("ERRO_INTERNO");

    const removidos = substituirErroDoBloco(erros, "graficos", null);
    expect(removidos).toEqual([erros[1]]);
  });
});
