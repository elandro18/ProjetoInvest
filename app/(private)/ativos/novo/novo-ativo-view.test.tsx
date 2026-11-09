import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { NovoAtivoView } from "./novo-ativo-view";

const navegacao = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navegacao,
}));

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

function responderReferencia() {
  return REFERENCIA;
}

async function abrirFormulario() {
  render(<NovoAtivoView />);
  await screen.findByLabelText("Classe");
}

function preencherDadosValidos() {
  fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "HGLG11" } });
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "CSHG Logística FII" },
  });
  fireEvent.change(screen.getByLabelText("Classe"), { target: { value: "fii" } });
  fireEvent.change(screen.getByLabelText("Segmento"), { target: { value: "log" } });
}

beforeEach(() => {
  navegacao.push.mockReset();
  navegacao.refresh.mockReset();
  apiRequestMock.mockReset();
});

describe("NovoAtivoView", () => {
  it("habilita o segmento para FII e desabilita para renda fixa com explicação", async () => {
    apiRequestMock.mockImplementation(async () => responderReferencia());

    await abrirFormulario();

    const classe = screen.getByLabelText("Classe");
    const segmento = screen.getByLabelText("Segmento");

    expect(segmento).toBeDisabled();

    fireEvent.change(classe, { target: { value: "fii" } });
    expect(segmento).toBeEnabled();
    expect(screen.getByText("Obrigatório para FII.")).toBeInTheDocument();

    fireEvent.change(segmento, { target: { value: "log" } });
    fireEvent.change(classe, { target: { value: "rf" } });

    expect(segmento).toBeDisabled();
    expect(screen.getByText("A classe selecionada não utiliza segmento.")).toBeInTheDocument();
    expect(segmento).toHaveValue("");
  });

  it("exige segmento de um FII no submit e leva o foco ao campo", async () => {
    apiRequestMock.mockImplementation(async () => responderReferencia());

    await abrirFormulario();
    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "HGLG11" } });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "CSHG Logística FII" },
    });
    fireEvent.change(screen.getByLabelText("Classe"), { target: { value: "fii" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o segmento para um FII.")).toBeInTheDocument();
    expect(screen.getByLabelText("Segmento")).toHaveFocus();
    expect(
      apiRequestMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });

  it("aplica a máscara de CNPJ e valida o dígito verificador no blur", async () => {
    apiRequestMock.mockImplementation(async () => responderReferencia());

    await abrirFormulario();

    const cnpj = screen.getByLabelText("CNPJ");
    fireEvent.change(cnpj, { target: { value: "12345678000195" } });
    expect(cnpj).toHaveValue("12.345.678/0001-95");

    fireEvent.blur(cnpj);
    expect(screen.queryByText("CNPJ inválido.")).not.toBeInTheDocument();

    fireEvent.change(cnpj, { target: { value: "12345678000100" } });
    expect(cnpj).toHaveValue("12.345.678/0001-00");

    fireEvent.blur(cnpj);
    expect(await screen.findByText("CNPJ inválido.")).toBeInTheDocument();
  });

  it("marca o campo, preserva os dados e foca o primeiro inválido no 409", async () => {
    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho === "/api/referencia/ativos") {
        return responderReferencia();
      }
      if (options?.method === "POST") {
        return {
          ok: false as const,
          status: 409,
          error: {
            code: "ATIVO_TICKER_DUPLICADO",
            message: "Já existe um ativo com este ticker.",
          },
        };
      }
      return responderReferencia();
    });

    await abrirFormulario();
    preencherDadosValidos();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Já existe um ativo com este ticker.")).toBeInTheDocument();
    expect(screen.getByLabelText("Ticker")).toHaveValue("HGLG11");
    expect(screen.getByLabelText("Ticker")).toHaveFocus();
    expect(screen.getByLabelText("Nome")).toHaveValue("CSHG Logística FII");
  });

  it("volta para a listagem com feedback após criar", async () => {
    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho === "/api/referencia/ativos") {
        return responderReferencia();
      }
      if (options?.method === "POST") {
        return {
          ok: true as const,
          status: 201,
          data: {
            id: "ativo-1",
            ticker: "HGLG11",
            nome: "CSHG Logística FII",
            classe: { id: "fii", codigo: "FII", nome: "Fundos Imobiliários" },
            segmento: { id: "log", codigo: "LOGISTICA", nome: "Logística" },
            status: "ATIVO",
            posicao: null,
            cnpj: null,
            administrador: null,
            gestor: null,
            fonteDados: null,
            observacoes: null,
            criadoEm: "2026-11-08T00:00:00.000Z",
            atualizadoEm: "2026-11-08T00:00:00.000Z",
            rendimentosAcumulados: "0.00",
            ultimosPrecos: [],
          },
        };
      }
      return responderReferencia();
    });

    await abrirFormulario();
    preencherDadosValidos();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(navegacao.push).toHaveBeenCalledWith("/ativos?criado=HGLG11");
    });
    expect(navegacao.refresh).toHaveBeenCalled();
  });
});
