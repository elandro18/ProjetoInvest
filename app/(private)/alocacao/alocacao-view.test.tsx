import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { AlocacaoView } from "./alocacao-view";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const METAS_VIGENTE = {
  classe: [
    { classeId: "c-rf", codigo: "RENDA_FIXA", percentual: "50.000000" },
    { classeId: "c-fii", codigo: "FII", percentual: "50.000000" },
  ],
  segmento: [
    { segmentoId: "s-log", codigo: "LOGISTICA", percentual: "25.000000" },
    { segmentoId: "s-shop", codigo: "SHOPPING", percentual: "15.000000" },
    { segmentoId: "s-rec", codigo: "RECEBIVEIS", percentual: "25.000000" },
    { segmentoId: "s-laj", codigo: "LAJES", percentual: "10.000000" },
    { segmentoId: "s-agro", codigo: "AGRO", percentual: "5.000000" },
    { segmentoId: "s-caixa", codigo: "CAIXA_OPORTUNIDADES", percentual: "5.000000" },
    { segmentoId: "s-urb", codigo: "RENDA_URBANA", percentual: "7.500000" },
    { segmentoId: "s-hib", codigo: "HIBRIDO", percentual: "7.500000" },
  ],
  vigenciaInicio: "2026-11-09",
} as const;

const DESVIOS = {
  ok: true as const,
  status: 200,
  data: {
    baseCalculo: "PATRIMONIO_TOTAL",
    itens: [
      {
        escopo: "CLASSE" as const,
        codigo: "RENDA_FIXA",
        percentualAtual: "40.041000",
        percentualMeta: "50.000000",
        desvioPontos: "-9.959000",
        valorParaMeta: "15170.00",
        situacao: "ABAIXO" as const,
        valorIndisponivel: false,
      },
      {
        escopo: "CLASSE" as const,
        codigo: "FII",
        percentualAtual: "59.959000",
        percentualMeta: "50.000000",
        desvioPontos: "9.959000",
        valorParaMeta: "0.00",
        situacao: "ACIMA" as const,
        valorIndisponivel: true,
      },
      {
        escopo: "SEGMENTO" as const,
        codigo: "LOGISTICA",
        percentualAtual: "25.200000",
        percentualMeta: "25.000000",
        desvioPontos: "0.200000",
        valorParaMeta: "0.00",
        situacao: "DENTRO" as const,
        valorIndisponivel: true,
      },
    ],
  },
};

const REFERENCIA = {
  ok: true as const,
  status: 200,
  data: { classes: [] },
};

const PUT_OK = {
  ok: true as const,
  status: 200,
  data: {
    vigente: {
      classe: [
        { classeId: "c-rf", codigo: "RENDA_FIXA", percentual: "60.000000" },
        { classeId: "c-fii", codigo: "FII", percentual: "40.000000" },
      ],
      segmento: METAS_VIGENTE.segmento,
      vigenciaInicio: "2026-11-09",
    },
  },
};

function respostaMetas() {
  return {
    ok: true as const,
    status: 200,
    data: { vigente: METAS_VIGENTE, historico: [] },
  };
}

function mockApi(put: unknown = PUT_OK, desvios: unknown = DESVIOS) {
  apiRequestMock.mockImplementation(async (caminho, options) => {
    if (caminho === "/api/alocacao/metas") {
      return options?.method === "PUT" ? (put as never) : (respostaMetas() as never);
    }
    if (caminho === "/api/alocacao/desvios") {
      return desvios as never;
    }
    if (caminho === "/api/referencia/ativos") {
      return REFERENCIA as never;
    }
    throw new Error(`Rota inesperada no teste: ${caminho}`);
  });
}

async function renderizar() {
  render(<AlocacaoView />);
  await screen.findByLabelText("Renda Fixa");
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("AlocacaoView", () => {
  it("calcula a soma em tempo real e bloqueia o salvar fora de 100%", async () => {
    mockApi();
    await renderizar();

    expect(screen.getAllByText("Soma: 100%.")).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Renda Fixa"), { target: { value: "40" } });
    expect(await screen.findByText("Faltam 10,0 p.p.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar metas por classe" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Renda Fixa"), { target: { value: "60" } });
    expect(await screen.findByText("Excede 10,0 p.p.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar metas por classe" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Fundos Imobiliários"), { target: { value: "40" } });
    expect(screen.getAllByText("Soma correta.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Salvar metas por classe" })).toBeEnabled();
  });

  it("pede confirmação explicando o histórico e envia os dois escopos", async () => {
    mockApi();
    await renderizar();

    fireEvent.change(screen.getByLabelText("Renda Fixa"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Fundos Imobiliários"), { target: { value: "40" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar metas por classe" }));

    expect(await screen.findByText(/passa para o histórico/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar metas" }));

    await waitFor(() => {
      expect(
        apiRequestMock.mock.calls.some(
          ([caminho, opcoes]) =>
            caminho === "/api/alocacao/metas" && opcoes?.method === "PUT",
        ),
      ).toBe(true);
    });

    const chamada = apiRequestMock.mock.calls.find(
      ([caminho, opcoes]) => caminho === "/api/alocacao/metas" && opcoes?.method === "PUT",
    );

    expect(chamada?.[1]?.body).toEqual({
      classe: [
        { referenciaId: "c-rf", percentual: "60.000000" },
        { referenciaId: "c-fii", percentual: "40.000000" },
      ],
      segmento: METAS_VIGENTE.segmento.map((meta) => ({
        referenciaId: meta.segmentoId,
        percentual: meta.percentual,
      })),
    });

    expect(
      await screen.findByText(/A configuração anterior foi preservada no histórico/),
    ).toBeInTheDocument();
  });

  it("renderiza os três estados de situação com texto além da cor", async () => {
    mockApi();
    await renderizar();

    await screen.findByText("Desvios por classe");

    expect(screen.getAllByText("Abaixo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Acima").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dentro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-9,96 p.p.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 15.170,00").length).toBeGreaterThan(0);
  });

  it("avisa quando o valor atual veio do custo de aquisição", async () => {
    mockApi();
    await renderizar();

    await screen.findByText("Desvios por classe");

    expect(screen.getByText("Valores pelo custo de aquisição")).toBeInTheDocument();
    expect(screen.getAllByText("Valor pelo custo").length).toBeGreaterThan(0);
    expect(screen.getByText(/não têm cotação de mercado/i)).toBeInTheDocument();
  });

  it("destaca o escopo quando o servidor recusa a soma e preserva o valor digitado", async () => {
    mockApi({
      ok: false,
      status: 422,
      error: {
        code: "ALO_SOMA_METAS_INVALIDA",
        message: "A soma das metas deve ser 100%.",
        details: { escopo: "CLASSE", soma: "90.000000" },
      },
    });
    await renderizar();

    fireEvent.change(screen.getByLabelText("Renda Fixa"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Fundos Imobiliários"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar metas por classe" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar metas" }));

    expect(
      await screen.findByText("A soma das metas deve ser 100% — recebido 90%."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Renda Fixa")).toHaveValue("60");
  });

  it("exibe tabela com 0% e CTA de cadastro quando não há patrimônio", async () => {
    mockApi(PUT_OK, {
      ok: true,
      status: 200,
      data: {
        baseCalculo: "PATRIMONIO_TOTAL",
        itens: [
          {
            escopo: "CLASSE",
            codigo: "RENDA_FIXA",
            percentualAtual: "0.000000",
            percentualMeta: "50.000000",
            desvioPontos: "-50.000000",
            valorParaMeta: "0.00",
            situacao: "ABAIXO",
            valorIndisponivel: false,
          },
          {
            escopo: "CLASSE",
            codigo: "FII",
            percentualAtual: "0.000000",
            percentualMeta: "50.000000",
            desvioPontos: "-50.000000",
            valorParaMeta: "0.00",
            situacao: "ABAIXO",
            valorIndisponivel: true,
          },
        ],
      },
    });
    await renderizar();

    expect(await screen.findByText("Sem patrimônio cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    // A configuração de metas não é escondida no estado sem patrimônio.
    expect(screen.getByLabelText("Renda Fixa")).toBeInTheDocument();
    expect(screen.getByLabelText("Logística")).toBeInTheDocument();
  });
});
