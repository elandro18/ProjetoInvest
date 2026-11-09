import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { CarteiraView } from "./carteira-view";
import { formatarMoeda, formatarPercentual, formatarQuantidade } from "./carteira-ui";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const RESUMO = {
  patrimonioTotal: "152340.00",
  rendaFixa: "61000.00",
  fiis: "91340.00",
  percentualRendaFixa: "40.041000",
  percentualFiis: "59.959000",
  quantidadeAtivos: 2,
  rendimentosMes: "820.00",
  rendimentosAcumuladosAno: "7340.00",
};

const POSICOES = [
  {
    ativoId: "ativo-1",
    ticker: "HGLG11",
    nome: "CSHG Logística",
    classe: { codigo: "FII", nome: "Fundos Imobiliários" },
    segmento: { codigo: "LOGISTICA", nome: "Logística" },
    quantidade: "100.00000000",
    precoMedio: "162.350000",
    custoTotal: "16235.00",
    valorAtual: "16235.00",
    valorIndisponivel: true,
    percentual: "10.656000",
  },
  {
    ativoId: "ativo-2",
    ticker: "KNRI11",
    nome: "Kinea Renda Imobiliária",
    classe: { codigo: "FII", nome: "Fundos Imobiliários" },
    segmento: { codigo: "HIBRIDO", nome: "Híbridos" },
    quantidade: "50.00000000",
    precoMedio: "140.000000",
    custoTotal: "7000.00",
    valorAtual: "7000.00",
    valorIndisponivel: true,
    percentual: "4.594000",
  },
] as const;

const CARTEIRA_DATA = {
  resumo: RESUMO,
  porClasse: [
    {
      codigo: "RENDA_FIXA",
      nome: "Renda Fixa",
      valor: "61000.00",
      percentual: "40.041000",
      valorIndisponivel: false,
    },
    {
      codigo: "FII",
      nome: "Fundos Imobiliários",
      valor: "91340.00",
      percentual: "59.959000",
      valorIndisponivel: true,
    },
  ],
  porSegmento: [
    {
      codigo: "LOGISTICA",
      nome: "Logística",
      valor: "91340.00",
      percentual: "59.959000",
      valorIndisponivel: true,
    },
  ],
  posicoes: POSICOES,
  consistente: true,
  atualizadoEm: "2026-11-07T18:00:00Z",
  cotacoes: { statusDado: "INDISPONIVEL", dataReferencia: null },
};

const ATIVOS_STATUS = {
  data: [
    {
      id: "ativo-1",
      ticker: "HGLG11",
      nome: "CSHG Logística",
      classe: { id: "c-fii", codigo: "FII", nome: "Fundos Imobiliários" },
      segmento: { id: "s-log", codigo: "LOGISTICA", nome: "Logística" },
      status: "ATIVO",
      posicao: null,
    },
    {
      id: "ativo-2",
      ticker: "KNRI11",
      nome: "Kinea Renda Imobiliária",
      classe: { id: "c-fii", codigo: "FII", nome: "Fundos Imobiliários" },
      segmento: { id: "s-hib", codigo: "HIBRIDO", nome: "Híbridos" },
      status: "INATIVO",
      posicao: null,
    },
  ],
  meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
};

function sucesso<T>(data: T) {
  return { ok: true as const, status: 200, data };
}

function mockApi(carteira: unknown = sucesso(CARTEIRA_DATA), ativos: unknown = sucesso(ATIVOS_STATUS)) {
  apiRequestMock.mockImplementation(async (caminho) => {
    if (caminho === "/api/carteira") {
      return carteira as never;
    }
    if (caminho.startsWith("/api/ativos")) {
      return ativos as never;
    }
    throw new Error(`Rota inesperada no teste: ${caminho}`);
  });
}

async function renderizar() {
  render(<CarteiraView />);
  await screen.findByRole("heading", { name: "Resumo" });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("formatação da carteira", () => {
  it("usa BRL, percentual com 1 casa e quantidade sem zeros à direita", () => {
    expect(formatarMoeda("152340.00")).toBe("R$ 152.340,00");
    expect(formatarMoeda("-1234.5")).toBe("-R$ 1.234,50");
    expect(formatarPercentual("40.041000")).toBe("40,0%");
    expect(formatarPercentual("100.000000")).toBe("100,0%");
    expect(formatarQuantidade("100.00000000")).toBe("100");
    expect(formatarQuantidade("1234.50000000")).toBe("1.234,5");
  });
});

describe("CarteiraView", () => {
  it("exibe o resumo com patrimônio, classes, ativos e rendimentos", async () => {
    mockApi();
    await renderizar();

    expect(screen.getByText("R$ 152.340,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 61.000,00")).toBeInTheDocument();
    expect(screen.getByText("40,0% da carteira")).toBeInTheDocument();
    expect(screen.getByText("R$ 91.340,00")).toBeInTheDocument();
    expect(screen.getByText("60,0% da carteira")).toBeInTheDocument();
    expect(screen.getByText("R$ 820,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 7.340,00")).toBeInTheDocument();
    expect(screen.getByText("Ativos na carteira")).toBeInTheDocument();

    expect(screen.getByText("R$ 61.000,00 · 40,0%")).toBeInTheDocument();
    // FII e Logística somam o mesmo valor no fixture: aparece na classe e no segmento.
    expect(screen.getAllByText("R$ 91.340,00 · 60,0%")).toHaveLength(2);
  });

  it("marca a posição sem cotação e mostra preço atual/resultado indisponíveis", async () => {
    mockApi();
    await renderizar();

    expect(screen.getByText("Valores pelo custo de aquisição")).toBeInTheDocument();
    expect(screen.getAllByText("valor indisponível").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);

    const linha = await screen.findByRole("row", { name: /HGLG11/ });
    expect(within(linha).getByText("Indisponível")).toBeInTheDocument();
    // Aguarda a situação chegar de /api/ativos para não confundir o "—" da
    // situação com o "—" de resultado.
    await waitFor(() => {
      expect(within(linha).getByText("Ativo")).toBeInTheDocument();
    });
    expect(within(linha).getByText("—")).toBeInTheDocument();
    expect(within(linha).getByText("valor indisponível")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 16.235,00")).toBeInTheDocument();
    expect(within(linha).getByText("10,7%")).toBeInTheDocument();
  });

  it("filtra por segmento no cliente", async () => {
    mockApi();
    await renderizar();

    fireEvent.change(screen.getByLabelText("Segmento"), { target: { value: "LOGISTICA" } });

    expect(await screen.findByText("1 de 2 posições")).toBeInTheDocument();
    expect(screen.queryByText("KNRI11")).not.toBeInTheDocument();
    expect(screen.getAllByText("HGLG11").length).toBeGreaterThan(0);
  });

  it("filtra por status usando o mapa de /api/ativos", async () => {
    mockApi();
    await renderizar();

    // Aguarda a coluna de situação carregar para o filtro ter o mapa completo.
    expect((await screen.findAllByText("Ativo")).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "INATIVO" } });

    expect(await screen.findByText("1 de 2 posições")).toBeInTheDocument();
    expect(screen.queryByText("HGLG11")).not.toBeInTheDocument();
    expect(screen.getAllByText("KNRI11").length).toBeGreaterThan(0);
  });

  it("ordena a tabela e expõe aria-sort no cabeçalho", async () => {
    mockApi();
    await renderizar();

    const cabecalho = screen.getByRole("columnheader", { name: /% da carteira/ });
    expect(cabecalho).toHaveAttribute("aria-sort", "none");

    fireEvent.click(screen.getByRole("button", { name: /Ordenar por % da carteira/ }));
    expect(cabecalho).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /Ordenar por % da carteira/ }));
    expect(cabecalho).toHaveAttribute("aria-sort", "descending");
  });

  it("avisa quando a soma por classe não fecha com o total", async () => {
    mockApi(sucesso({ ...CARTEIRA_DATA, consistente: false }));
    await renderizar();

    expect(
      screen.getByText("A soma por classe não fecha com o total — verifique os dados."),
    ).toBeInTheDocument();
  });

  it("mostra o estado vazio com CTAs de ativo e renda fixa", async () => {
    mockApi(
      sucesso({
        resumo: {
          patrimonioTotal: "0.00",
          rendaFixa: "0.00",
          fiis: "0.00",
          percentualRendaFixa: "0.000000",
          percentualFiis: "0.000000",
          quantidadeAtivos: 0,
          rendimentosMes: "0.00",
          rendimentosAcumuladosAno: "0.00",
        },
        porClasse: [],
        porSegmento: [],
        posicoes: [],
        consistente: true,
        atualizadoEm: "2026-11-07T18:00:00Z",
        cotacoes: { statusDado: "INDISPONIVEL", dataReferencia: null },
      }),
    );

    render(<CarteiraView />);

    expect(await screen.findByText("Sua carteira está vazia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
    expect(screen.getByRole("link", { name: "Cadastrar renda fixa" })).toHaveAttribute(
      "href",
      "/renda-fixa",
    );
    expect(screen.queryByRole("heading", { name: "Resumo" })).not.toBeInTheDocument();
  });

  it("mostra erro com traceId e permite tentar novamente", async () => {
    let chamadas = 0;
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho === "/api/carteira") {
        chamadas += 1;
        if (chamadas === 1) {
          return {
            ok: false as const,
            status: 500,
            error: {
              code: "ERRO_INTERNO",
              message: "Erro inesperado. Tente novamente.",
              details: { traceId: "trace-123" },
            },
          } as never;
        }
        return sucesso(CARTEIRA_DATA) as never;
      }
      if (caminho.startsWith("/api/ativos")) {
        return sucesso(ATIVOS_STATUS) as never;
      }
      throw new Error(`Rota inesperada no teste: ${caminho}`);
    });

    render(<CarteiraView />);

    expect(await screen.findByText("Não foi possível carregar a carteira")).toBeInTheDocument();
    expect(screen.getByText("trace-123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.getByText("R$ 152.340,00")).toBeInTheDocument();
    });
  });
});
