import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { RendaFixaForm } from "./renda-fixa-form";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const CRIADO = {
  id: "rf-1",
  instituicao: "Banco X",
  produto: "CDB" as const,
  indexador: "POS_CDI" as const,
  taxa: "12.500000",
  dataAplicacao: "2026-01-10",
  vencimento: "2028-01-10",
  valorAplicado: "10000.00",
  saldoAtual: "10450.00",
  statusSaldo: "INFORMADO" as const,
  liquidez: "NO_VENCIMENTO" as const,
  carenciaAte: null,
  coberturaFgc: true,
  observacoes: null,
  criadoEm: "2026-11-09T12:00:00.000Z",
  atualizadoEm: "2026-11-09T12:00:00.000Z",
};

function renderizarFormulario(overrides: Partial<Parameters<typeof RendaFixaForm>[0]> = {}) {
  const props = {
    aberto: true,
    onFechar: vi.fn(),
    onCriado: vi.fn(),
    onSessaoExpirada: vi.fn(),
    ...overrides,
  };
  render(<RendaFixaForm {...props} />);
  return props;
}

function preencherFormularioValido() {
  fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "Banco X" } });
  fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "CDB" } });
  fireEvent.change(screen.getByLabelText("Indexador"), { target: { value: "POS_CDI" } });
  fireEvent.change(screen.getByLabelText("Taxa (% a.a.)"), { target: { value: "12,5" } });
  fireEvent.change(screen.getByLabelText("Data de aplicação"), {
    target: { value: "2026-01-10" },
  });
  fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2028-01-10" } });
  fireEvent.change(screen.getByLabelText("Valor aplicado (R$)"), {
    target: { value: "10.000,00" },
  });
  fireEvent.change(screen.getByLabelText("Saldo atual (R$)"), {
    target: { value: "10.450,00" },
  });
  fireEvent.change(screen.getByLabelText("Liquidez"), { target: { value: "NO_VENCIMENTO" } });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("RendaFixaForm", () => {
  it("deriva a cobertura FGC do produto e preserva a sobrescrita do titular", () => {
    renderizarFormulario();

    const cobertura = screen.getByLabelText(/Cobertura FGC/) as HTMLInputElement;
    expect(cobertura).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "CDB" } });
    expect(cobertura).toBeChecked();

    fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "TESOURO_SELIC" } });
    expect(cobertura).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "LCI" } });
    expect(cobertura).toBeChecked();

    fireEvent.click(cobertura);
    expect(cobertura).not.toBeChecked();

    // Override explícito não é desfeito por uma nova troca de produto.
    fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "LCA" } });
    expect(cobertura).not.toBeChecked();
  });

  it("bloqueia vencimento anterior à aplicação e data de aplicação futura", () => {
    renderizarFormulario();

    fireEvent.change(screen.getByLabelText("Data de aplicação"), {
      target: { value: "2026-01-10" },
    });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2025-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      screen.getByText("O vencimento deve ser posterior à aplicação."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Data de aplicação"), {
      target: { value: "2099-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      screen.getByText("A data de aplicação não pode ser futura."),
    ).toBeInTheDocument();
    expect(
      apiRequestMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });

  it("marca a taxa fora de 0–100 e não envia o cadastro", () => {
    renderizarFormulario();

    fireEvent.change(screen.getByLabelText("Taxa (% a.a.)"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      screen.getByText("A taxa deve estar entre 0 e 100% a.a."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa (% a.a.)")).toHaveAttribute("aria-invalid", "true");
    expect(
      apiRequestMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });

  it("normaliza o corpo do cadastro com FGC derivado e decimais do contrato", async () => {
    apiRequestMock.mockImplementation(async () => ({
      ok: true as const,
      status: 201,
      data: CRIADO,
    }));
    const props = renderizarFormulario();

    preencherFormularioValido();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(props.onCriado).toHaveBeenCalledWith(CRIADO));

    const chamada = apiRequestMock.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(chamada?.[0]).toBe("/api/renda-fixa");
    expect(chamada?.[1]?.body).toEqual({
      instituicao: "Banco X",
      produto: "CDB",
      indexador: "POS_CDI",
      taxa: "12.500000",
      dataAplicacao: "2026-01-10",
      vencimento: "2028-01-10",
      valorAplicado: "10000.00",
      saldoAtual: "10450.00",
      statusSaldo: "INFORMADO",
      liquidez: "NO_VENCIMENTO",
      carenciaAte: null,
      coberturaFgc: true,
      observacoes: null,
    });
  });

  it("interpreta ponto como milhar em campo monetário sem vírgula", async () => {
    apiRequestMock.mockImplementation(async () => ({
      ok: true as const,
      status: 201,
      data: CRIADO,
    }));
    const props = renderizarFormulario();

    preencherFormularioValido();
    fireEvent.change(screen.getByLabelText("Valor aplicado (R$)"), {
      target: { value: "1.000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(props.onCriado).toHaveBeenCalled());
    const chamada = apiRequestMock.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect((chamada?.[1]?.body as { valorAplicado: string }).valorAplicado).toBe("1000.00");
  });

  it("marca o campo do 422 e preserva os dados digitados", async () => {
    apiRequestMock.mockImplementation(async () => ({
      ok: false as const,
      status: 422,
      error: {
        code: "VALIDACAO",
        message: "Um ou mais campos são inválidos.",
        details: { errors: [{ field: "taxa", message: "Taxa inválida." }] },
      },
    }));
    renderizarFormulario();

    preencherFormularioValido();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Taxa inválida.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Instituição")).toHaveValue("Banco X");
    expect(screen.getByLabelText("Valor aplicado (R$)")).toHaveValue("10.000,00");
  });
});
