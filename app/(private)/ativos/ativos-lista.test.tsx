import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { AtivosLista } from "./ativos-lista";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const REFERENCIA = {
  ok: true as const,
  status: 200,
  data: {
    classes: [
      { id: "rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", segmentos: [] },
      {
        id: "fii",
        codigo: "FII",
        nome: "Fundos Imobiliários",
        segmentos: [{ id: "log", codigo: "LOGISTICA", nome: "Logística" }],
      },
    ],
  },
};

const LISTA_VAZIA = {
  ok: true as const,
  status: 200,
  data: {
    data: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  },
};

const LISTA_COM_ATIVO = {
  ok: true as const,
  status: 200,
  data: {
    data: [
      {
        id: "ativo-1",
        ticker: "HGLG11",
        nome: "CSHG Logística FII",
        classe: { id: "fii", codigo: "FII", nome: "Fundos Imobiliários" },
        segmento: { id: "log", codigo: "LOGISTICA", nome: "Logística" },
        status: "ATIVO",
        posicao: null,
      },
    ],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  },
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("AtivosLista", () => {
  it("mostra estado vazio com CTA para o primeiro cadastro", async () => {
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      return LISTA_VAZIA;
    });

    render(<AtivosLista />);

    expect(await screen.findByText("Nenhum ativo cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar primeiro ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
  });

  it("mostra o erro com traceId e permite tentar novamente", async () => {
    let chamadasDeLista = 0;
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      chamadasDeLista += 1;
      if (chamadasDeLista === 1) {
        return {
          ok: false as const,
          status: 500,
          error: {
            code: "ERRO_INTERNO",
            message: "Erro inesperado. Tente novamente.",
            details: { traceId: "trace-123" },
          },
        };
      }
      return LISTA_COM_ATIVO;
    });

    render(<AtivosLista />);

    expect(await screen.findByText("trace-123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    const tabela = await screen.findByRole("table");
    expect(within(tabela).getByText("HGLG11")).toBeInTheDocument();
  });

  it("ordena por ticker com aria-sort e inverte a direção no segundo clique", async () => {
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      return LISTA_COM_ATIVO;
    });

    render(<AtivosLista />);

    await screen.findByRole("table");
    const cabecalhoTicker = screen.getByRole("columnheader", { name: /Ticker/ });

    expect(cabecalhoTicker).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(within(cabecalhoTicker).getByRole("button"));

    await waitFor(() => {
      expect(
        screen.getByRole("columnheader", { name: /Ticker/ }),
      ).toHaveAttribute("aria-sort", "descending");
    });

    const tabelaAtualizada = await screen.findByRole("table");
    expect(within(tabelaAtualizada).getByText("HGLG11")).toBeInTheDocument();
  });
});
