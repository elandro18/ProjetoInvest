import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { AtivoFichaView } from "./ativo-ficha-view";
import type { StatusAtivo } from "../ativos-ui";

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

const ATIVO = {
  id: "ativo-1",
  ticker: "HGLG11",
  nome: "CSHG Logística FII",
  classe: { id: "fii", codigo: "FII", nome: "Fundos Imobiliários" },
  segmento: { id: "log", codigo: "LOGISTICA", nome: "Logística" },
  status: "ATIVO" as StatusAtivo,
  posicao: null,
  cnpj: "12345678000195",
  administrador: "CSHG",
  gestor: "Pátria",
  fonteDados: "cvm",
  observacoes: "Fundo de logística.",
  criadoEm: "2026-11-08T00:00:00.000Z",
  atualizadoEm: "2026-11-08T00:00:00.000Z",
  rendimentosAcumulados: "0.00",
  ultimosPrecos: [],
};

function mockDetalhe(override: Partial<typeof ATIVO> = {}) {
  return {
    ok: true as const,
    status: 200,
    data: { ...ATIVO, ...override },
  };
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("AtivoFichaView", () => {
  it("mostra posição e preço indisponíveis sem inventar zero", async () => {
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      return mockDetalhe();
    });

    render(<AtivoFichaView ativoId="ativo-1" />);

    expect(await screen.findByRole("heading", { name: "HGLG11", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
    expect(screen.getByText("Sem posição")).toBeInTheDocument();
    expect(screen.getByText("12.345.678/0001-95")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Movimentações" }));
    expect(screen.getByText("Disponível em breve")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Histórico de preços" }));
    expect(screen.getByText("Sem cotação na Fase 1")).toBeInTheDocument();
  });

  it("bloqueia ticker e classe na edição com explicação", async () => {
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      return mockDetalhe();
    });

    render(<AtivoFichaView ativoId="ativo-1" />);
    await screen.findByRole("heading", { name: "HGLG11", level: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Ticker")).toBeDisabled();
    expect(screen.getByText("O ticker não pode ser alterado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Classe")).toBeDisabled();
    expect(screen.getByText("A classe é imutável nesta versão.")).toBeInTheDocument();
  });

  it("persiste a edição e exibe a confirmação", async () => {
    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      if (options?.method === "PATCH") {
        return mockDetalhe({ nome: "CSHG Logística Atualizado" });
      }
      return mockDetalhe();
    });

    render(<AtivoFichaView ativoId="ativo-1" />);
    await screen.findByRole("heading", { name: "HGLG11", level: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "CSHG Logística Atualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
    expect(screen.getAllByText("CSHG Logística Atualizado").length).toBeGreaterThan(0);

    const chamadaPatch = apiRequestMock.mock.calls.find(
      ([, options]) => options?.method === "PATCH",
    );
    expect(chamadaPatch?.[0]).toBe("/api/ativos/ativo-1");
    expect(chamadaPatch?.[1]?.body).toMatchObject({ nome: "CSHG Logística Atualizado" });
  });

  it("inativa o ativo após confirmação no diálogo", async () => {
    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho.startsWith("/api/referencia")) {
        return REFERENCIA;
      }
      if (options?.method === "PATCH") {
        return mockDetalhe({ status: "INATIVO" });
      }
      return mockDetalhe();
    });

    render(<AtivoFichaView ativoId="ativo-1" />);
    await screen.findByRole("heading", { name: "HGLG11", level: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));

    const dialogo = screen.getByRole("dialog", { name: "Inativar ativo" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Inativar ativo" }));

    expect(await screen.findByText("Ativo inativado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();

    await waitFor(() => {
      const chamada = apiRequestMock.mock.calls.find(([, options]) => options?.method === "PATCH");
      expect(chamada?.[1]?.body).toEqual({ status: "INATIVO" });
    });
  });
});
