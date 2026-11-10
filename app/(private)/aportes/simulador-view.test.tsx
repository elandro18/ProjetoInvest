import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import {
  compararLinhas,
  descreverDelta,
  diferencaPatrimonio,
  formatarPercentualSimulacao,
  larguraBarra,
  validarValorSimulacao,
} from "./simulador-ui";
import { SimuladorAporte } from "./simulador-view";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

/**
 * Cenário do critério de aceitação da RN-028: RF 35% / FII 65% e aporte de
 * R$ 1.000,00 aplicado 100% em RF → 4.500/11.000 = 40,909091% (+5,909091 p.p.).
 */
const SIMULACAO = {
  ok: true as const,
  status: 200,
  data: {
    valorAporte: "1000.00",
    antes: {
      patrimonioTotal: "10000.00",
      classe: [
        { codigo: "RENDA_FIXA", valor: "3500.00", percentual: "35.000000" },
        { codigo: "FII", valor: "6500.00", percentual: "65.000000" },
      ],
      segmento: [
        { codigo: "LOGISTICA", valor: "4000.00", percentual: "40.000000" },
        { codigo: "SHOPPING", valor: "2500.00", percentual: "25.000000" },
      ],
    },
    depois: {
      patrimonioTotal: "11000.00",
      classe: [
        { codigo: "RENDA_FIXA", valor: "4500.00", percentual: "40.909091" },
        { codigo: "FII", valor: "6500.00", percentual: "59.090909" },
      ],
      segmento: [
        { codigo: "LOGISTICA", valor: "4000.00", percentual: "36.363636" },
        { codigo: "SHOPPING", valor: "2500.00", percentual: "22.727273" },
      ],
    },
    delta: {
      classe: [
        { codigo: "RENDA_FIXA", pontosPercentuais: "5.909091" },
        { codigo: "FII", pontosPercentuais: "-5.909091" },
      ],
      segmento: [
        { codigo: "LOGISTICA", pontosPercentuais: "-3.636364" },
        { codigo: "SHOPPING", pontosPercentuais: "-2.272727" },
      ],
    },
  },
};

const SIMULACAO_SEM_MUDANCA = {
  ...SIMULACAO,
  data: {
    ...SIMULACAO.data,
    delta: {
      classe: SIMULACAO.data.delta.classe,
      segmento: [
        { codigo: "LOGISTICA", pontosPercentuais: "0.000000" },
        { codigo: "SHOPPING", pontosPercentuais: "0.000001" },
        { codigo: "LAJES", pontosPercentuais: "0.000000" },
      ],
    },
    depois: {
      ...SIMULACAO.data.depois,
      segmento: [
        ...SIMULACAO.data.depois.segmento,
        { codigo: "LAJES", valor: "0.00", percentual: "0.000000" },
      ],
    },
    antes: {
      ...SIMULACAO.data.antes,
      segmento: [
        ...SIMULACAO.data.antes.segmento,
        { codigo: "LAJES", valor: "0.00", percentual: "0.000000" },
      ],
    },
  },
};

const SIMULACAO_CARTEIRA_VAZIA = {
  ...SIMULACAO,
  data: {
    ...SIMULACAO.data,
    antes: {
      patrimonioTotal: "0.00",
      classe: [
        { codigo: "RENDA_FIXA", valor: "0.00", percentual: "0.000000" },
        { codigo: "FII", valor: "0.00", percentual: "0.000000" },
      ],
      segmento: [],
    },
    depois: {
      patrimonioTotal: "1000.00",
      classe: [
        { codigo: "RENDA_FIXA", valor: "350.00", percentual: "35.000000" },
        { codigo: "FII", valor: "650.00", percentual: "65.000000" },
      ],
      segmento: [],
    },
    delta: {
      classe: [
        { codigo: "RENDA_FIXA", pontosPercentuais: "35.000000" },
        { codigo: "FII", pontosPercentuais: "65.000000" },
      ],
      segmento: [],
    },
  },
};

function mockApi(resultado: unknown = SIMULACAO) {
  apiRequestMock.mockImplementation(async () => resultado as never);
}

function preencherValor(valor: string) {
  fireEvent.change(screen.getByLabelText("Valor a simular (R$)"), { target: { value: valor } });
}

function simular() {
  fireEvent.click(screen.getByRole("button", { name: "Simular" }));
}

async function simularMil() {
  render(<SimuladorAporte />);
  preencherValor("1.000,00");
  simular();
  await screen.findByRole("heading", { name: "Simulação para R$ 1.000,00" });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("SimuladorAporte — entrada e aviso permanente", () => {
  it("avisa que nada é aplicado à carteira e preenche pelos atalhos", () => {
    render(<SimuladorAporte />);

    expect(screen.getByText("Simulação — nada é aplicado à carteira")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum valor é comprado, vendido ou registrado/)).toBeInTheDocument();

    const campo = screen.getByLabelText("Valor a simular (R$)");
    for (const [rotulo, esperado] of [
      ["Simular R$ 500", "500,00"],
      ["Simular R$ 1.000", "1.000,00"],
      ["Simular R$ 1.500", "1.500,00"],
      ["Simular R$ 2.000", "2.000,00"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: rotulo }));
      expect(campo).toHaveValue(esperado);
    }

    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("bloqueia valor vazio, zero ou inválido sem chamar a API", () => {
    render(<SimuladorAporte />);

    simular();
    expect(screen.getByText("Informe o valor a simular (ex.: 1.000,00).")).toBeInTheDocument();

    preencherValor("0");
    simular();
    expect(screen.getByText("O valor a simular deve ser maior que zero.")).toBeInTheDocument();

    preencherValor("abc");
    simular();
    expect(screen.getByText("Informe um valor válido (ex.: 1.234,56).")).toBeInTheDocument();

    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("valida no blur e limpa o erro ao digitar", () => {
    render(<SimuladorAporte />);
    const campo = screen.getByLabelText("Valor a simular (R$)");

    fireEvent.change(campo, { target: { value: "0" } });
    fireEvent.blur(campo);
    expect(screen.getByText("O valor a simular deve ser maior que zero.")).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "10" } });
    expect(
      screen.queryByText("O valor a simular deve ser maior que zero."),
    ).not.toBeInTheDocument();
  });
});

describe("SimuladorAporte — comparativo antes × depois", () => {
  it("envia o valor do contrato e mostra antes, depois e delta em p.p. com sinal", async () => {
    mockApi();
    await simularMil();

    expect(apiRequestMock).toHaveBeenCalledWith("/api/aportes/simulacao", {
      method: "POST",
      body: { valorAporte: "1000.00" },
    });

    expect(
      screen.getByRole("heading", { name: "Antes × depois por classe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Antes × depois por segmento" }),
    ).toBeInTheDocument();

    // Patrimônio de antes → depois, com o efeito do aporte em texto.
    expect(
      screen.getByText(
        /Patrimônio de R\$ 10\.000,00 para R\$ 11\.000,00 \(\+R\$ 1\.000,00\)/,
      ),
    ).toBeInTheDocument();

    // RF 35% → 40,9%: sinal, unidade e leitura em palavras.
    expect(screen.getByText("+5,9 p.p.")).toBeInTheDocument();
    expect(screen.getByText("aumento de 5,9 p.p.")).toBeInTheDocument();
    expect(screen.getByText("35,0%")).toBeInTheDocument();
    expect(screen.getByText("40,9%")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 4.500,00").length).toBeGreaterThan(0);

    // FII cai na mesma proporção: negativo com sinal.
    expect(screen.getByText("−5,9 p.p.")).toBeInTheDocument();
    expect(screen.getByText("redução de 5,9 p.p.")).toBeInTheDocument();
    expect(screen.getByText("65,0%")).toBeInTheDocument();
    expect(screen.getByText("59,1%")).toBeInTheDocument();
  });

  it("exibe todas as linhas e marca 'sem alteração' quando o delta é zero", async () => {
    mockApi(SIMULACAO_SEM_MUDANCA);
    await simularMil();

    const secaoSegmento = screen.getByRole("region", {
      name: "Antes × depois por segmento",
    });
    expect(secaoSegmento).toHaveTextContent("Logística");
    expect(secaoSegmento).toHaveTextContent("R$ 4.000,00");
    expect(secaoSegmento).toHaveTextContent("40,0%");
    expect(secaoSegmento).toHaveTextContent("36,4%");

    // Delta 0,000000 → "sem alteração"; 0,000001 arredonda para 0,0 p.p.
    expect(screen.getAllByText("sem alteração")).toHaveLength(2);
    expect(screen.getAllByText("sem alteração na participação")).toHaveLength(2);

    // Linha idêntica dos dois lados aparece compacta, sem perder o valor.
    expect(screen.getByText("R$ 0,00 · 0,0% · sem alteração")).toBeInTheDocument();
    expect(screen.getByText("Lajes Corporativas")).toBeInTheDocument();
  });

  it("publica o resultado em região aria-live", async () => {
    mockApi();
    await simularMil();

    const titulo = screen.getByRole("heading", { name: "Simulação para R$ 1.000,00" });
    expect(titulo.closest("[aria-live='polite']")).not.toBeNull();
  });
});

describe("SimuladorAporte — estados", () => {
  it("mostra o erro de campo quando o servidor responde 422", async () => {
    mockApi({
      ok: false,
      status: 422,
      error: {
        code: "APORTE_VALOR_INVALIDO",
        message: "Informe um valor de aporte maior que zero.",
      },
    });

    render(<SimuladorAporte />);
    preencherValor("1.000,00");
    simular();

    expect(
      await screen.findByText("Informe um valor de aporte maior que zero."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Simulação para/ })).not.toBeInTheDocument();
    // O valor digitado nunca é perdido em erro 422 (UI_SPEC §16).
    expect(screen.getByLabelText("Valor a simular (R$)")).toHaveValue("1.000,00");
  });

  it("orienta a configurar metas quando o servidor responde 409", async () => {
    mockApi({
      ok: false,
      status: 409,
      error: {
        code: "APORTE_DADOS_INSUFICIENTES",
        message: "Não há dados suficientes para sugerir uma distribuição.",
      },
    });

    render(<SimuladorAporte />);
    preencherValor("1.000,00");
    simular();

    expect(await screen.findByText("Sem metas para simular")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar metas em /alocacao" })).toHaveAttribute(
      "href",
      "/alocacao",
    );
  });

  it("simula a partir das metas quando a carteira está vazia", async () => {
    mockApi(SIMULACAO_CARTEIRA_VAZIA);
    await simularMil();

    expect(
      screen.getByText("Carteira vazia — simulação a partir das metas"),
    ).toBeInTheDocument();
    expect(screen.getByText("35,0%")).toBeInTheDocument();
    expect(screen.getByText("65,0%")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum segmento nas metas vigentes/),
    ).toBeInTheDocument();
  });

  it("mostra o estado de cálculo e depois o resultado", async () => {
    let resolver: ((resultado: unknown) => void) | null = null;
    apiRequestMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }) as never,
    );

    render(<SimuladorAporte />);
    preencherValor("1.000,00");
    simular();

    expect(await screen.findByText("Calculando a simulação…")).toBeInTheDocument();

    await act(async () => {
      resolver?.(SIMULACAO);
    });

    expect(
      await screen.findByRole("heading", { name: "Simulação para R$ 1.000,00" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Calculando a simulação…")).not.toBeInTheDocument(),
    );
  });

  it("mostra erro com retry e recupera na nova tentativa", async () => {
    let tentativas = 0;
    apiRequestMock.mockImplementation(async () => {
      tentativas += 1;
      return tentativas === 1
        ? ({
            ok: false,
            status: 0,
            error: { code: "ERRO_REDE", message: "Não foi possível conectar." },
          } as never)
        : (SIMULACAO as never);
    });

    render(<SimuladorAporte />);
    preencherValor("1.000,00");
    simular();

    expect(await screen.findByText("Não foi possível simular o aporte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", { name: "Simulação para R$ 1.000,00" }),
    ).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });
});

describe("simulador-ui", () => {
  it("valida o valor a simular", () => {
    expect(validarValorSimulacao("")).toBe("Informe o valor a simular (ex.: 1.000,00).");
    expect(validarValorSimulacao("0")).toBe("O valor a simular deve ser maior que zero.");
    expect(validarValorSimulacao("abc")).toBe("Informe um valor válido (ex.: 1.234,56).");
    expect(validarValorSimulacao("1.500,00")).toBeNull();
  });

  it("descreve o delta com sinal, arredondamento de 1 casa e texto", () => {
    expect(descreverDelta("5.909091")).toEqual({
      texto: "+5,9 p.p.",
      explicacao: "aumento de 5,9 p.p.",
      variacao: "aumento",
    });
    expect(descreverDelta("-5.909091")).toEqual({
      texto: "−5,9 p.p.",
      explicacao: "redução de 5,9 p.p.",
      variacao: "reducao",
    });
    expect(descreverDelta("0.000000").variacao).toBe("sem-alteracao");
    expect(descreverDelta("0.000001").texto).toBe("sem alteração");
    expect(descreverDelta("abc").texto).toBe("Indisponível");
  });

  it("formata percentual, patrimônio e largura de barra", () => {
    expect(formatarPercentualSimulacao("40.909091")).toBe("40,9%");
    expect(formatarPercentualSimulacao("0.000000")).toBe("0,0%");
    expect(formatarPercentualSimulacao("abc")).toBe("Indisponível");

    expect(diferencaPatrimonio("10000.00", "11000.00")).toBe("+R$ 1.000,00");
    expect(diferencaPatrimonio("10000.00", "10000.00")).toBe("sem alteração");

    expect(larguraBarra("35.000000")).toBe(35);
    expect(larguraBarra("120.000000")).toBe(100);
    expect(larguraBarra("-10.000000")).toBe(0);
    expect(larguraBarra("abc")).toBe(0);
  });

  it("monta o comparativo com todas as linhas, inclusive as que só vêm de um lado", () => {
    const linhas = compararLinhas(
      SIMULACAO.data.antes.classe,
      [
        ...SIMULACAO.data.depois.classe,
        { codigo: "CAIXA_OPORTUNIDADES", valor: "10.00", percentual: "0.100000" },
      ],
      SIMULACAO.data.delta.classe,
    );

    expect(linhas.map((linha) => linha.codigo)).toEqual([
      "RENDA_FIXA",
      "FII",
      "CAIXA_OPORTUNIDADES",
    ]);
    expect(linhas[2].rotulo).toBe("Caixa e Oportunidades");
    expect(linhas[2].antes.valor).toBe("0.00");
    expect(linhas[2].deltaTexto).toBe("sem alteração");
  });
});
