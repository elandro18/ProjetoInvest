import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { MovimentacoesView } from "./movimentacoes-view";
import type {
  AtivoOpcaoApi,
  MovimentacaoApi,
  RespostaCancelamentoApi,
} from "./movimentacoes-ui";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const ATIVO: AtivoOpcaoApi = {
  id: "a1",
  ticker: "HGLG11",
  nome: "CSHG Logística",
  classe: { codigo: "FII" },
  status: "ATIVO",
};

const MOVIMENTACAO: MovimentacaoApi = {
  id: "m1",
  ativo: { id: "a1", ticker: "HGLG11" },
  tipo: "COMPRA",
  data: "2026-11-05",
  quantidade: "10.00000000",
  valorUnitario: "100.00",
  valorTotal: "1003.00",
  custos: "3.00",
  observacoes: null,
  canceladaEm: null,
  cancelamentoMotivo: null,
  criadoEm: "2026-11-09T12:00:00.000Z",
};

const CANCELADA: RespostaCancelamentoApi = {
  movimentacao: {
    ...MOVIMENTACAO,
    canceladaEm: "2026-11-09T13:00:00.000Z",
    cancelamentoMotivo: "Erro de lançamento",
  },
  posicao: {
    quantidade: "0.00000000",
    precoMedio: "0.000000",
    custoTotal: "0.00",
  },
};

function listaCom(itens: readonly MovimentacaoApi[]) {
  return {
    data: itens,
    meta: { page: 1, pageSize: 20, total: itens.length, totalPages: itens.length === 0 ? 0 : 1 },
  };
}

function configurarApi(itens: readonly MovimentacaoApi[]) {
  apiRequestMock.mockImplementation(async (caminho, options) => {
    if (options?.method === "POST" && caminho.includes("/cancelamento")) {
      return { ok: true as const, status: 200, data: CANCELADA };
    }
    if (caminho.startsWith("/api/ativos")) {
      return { ok: true as const, status: 200, data: { data: [ATIVO] } };
    }
    if (caminho.startsWith("/api/movimentacoes?")) {
      return { ok: true as const, status: 200, data: listaCom(itens) };
    }
    return {
      ok: false as const,
      status: 500,
      error: { code: "ERRO_INTERNO", message: "Algo deu errado." },
    };
  });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("MovimentacoesView", () => {
  it("mostra estado vazio com CTA para a primeira movimentação", async () => {
    configurarApi([]);
    render(<MovimentacoesView />);

    expect(await screen.findByText("Nenhuma movimentação registrada")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Nova movimentação" })[0]);
    expect(screen.getByRole("dialog", { name: "Nova movimentação" })).toBeInTheDocument();
  });

  it("cancela com motivo, mantém o item na lista com badge e informa a posição", async () => {
    configurarApi([MOVIMENTACAO]);
    render(<MovimentacoesView />);

    await screen.findAllByText("HGLG11");
    expect(screen.getByRole("table")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Cancelar movimentação de HGLG11 de 05/11/2026",
      })[0],
    );

    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), {
      target: { value: "Erro de lançamento" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => expect(screen.getAllByText("Cancelada").length).toBeGreaterThan(0));
    expect(screen.getByText(/Posição de HGLG11: 0 cotas/)).toBeInTheDocument();
    expect(screen.getAllByText("HGLG11").length).toBeGreaterThan(0);

    const chamada = apiRequestMock.mock.calls.find(
      ([caminho, options]) =>
        options?.method === "POST" && caminho.includes("/cancelamento"),
    );
    expect(chamada?.[0]).toBe("/api/movimentacoes/m1/cancelamento");
    expect(chamada?.[1]?.body).toEqual({ motivo: "Erro de lançamento" });
  });

  it("aplica filtros de tipo e período na consulta da lista", async () => {
    configurarApi([MOVIMENTACAO]);
    render(<MovimentacoesView />);

    await waitFor(() =>
      expect(
        apiRequestMock.mock.calls.some(([caminho]) =>
          caminho.startsWith("/api/movimentacoes?"),
        ),
      ).toBe(true),
    );

    fireEvent.change(screen.getByLabelText("Filtrar por tipo"), {
      target: { value: "VENDA" },
    });
    fireEvent.change(screen.getByLabelText("Data inicial"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final"), {
      target: { value: "2026-11-30" },
    });
    fireEvent.click(screen.getByLabelText("Incluir canceladas"));

    await waitFor(() => {
      const ultima = apiRequestMock.mock.calls
        .map(([caminho]) => caminho)
        .filter((caminho) => caminho.startsWith("/api/movimentacoes?"))
        .at(-1);
      expect(ultima).toContain("tipo=VENDA");
      expect(ultima).toContain("de=2026-11-01");
      expect(ultima).toContain("ate=2026-11-30");
      expect(ultima).toContain("incluirCanceladas=true");
    });
  });
});
