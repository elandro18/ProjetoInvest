import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { NovaMovimentacaoForm } from "./nova-movimentacao-form";
import type {
  AtivoOpcaoApi,
  RespostaCriacaoMovimentacaoApi,
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

const CRIADA: RespostaCriacaoMovimentacaoApi = {
  movimentacao: {
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
  },
  posicao: {
    quantidade: "10.00000000",
    precoMedio: "100.300000",
    custoTotal: "1003.00",
  },
};

function renderizarFormulario(
  overrides: Partial<Parameters<typeof NovaMovimentacaoForm>[0]> = {},
) {
  const props = {
    aberto: true,
    ativos: [ATIVO],
    carregandoAtivos: false,
    erroAtivos: null,
    onRecarregarAtivos: vi.fn(),
    onFechar: vi.fn(),
    onCriada: vi.fn(),
    onSessaoExpirada: vi.fn(),
    ...overrides,
  };
  render(<NovaMovimentacaoForm {...props} />);
  return props;
}

function selecionarAtivo() {
  fireEvent.change(screen.getByLabelText("Ativo"), { target: { value: ATIVO.id } });
}

function preencherCompra(total = "1.003,00") {
  selecionarAtivo();
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Valor unitário (R$)"), {
    target: { value: "100,00" },
  });
  fireEvent.change(screen.getByLabelText("Custos (R$)"), { target: { value: "3,00" } });
  fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: total } });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("NovaMovimentacaoForm", () => {
  it("calcula o total em tempo real e sinaliza divergência acima de R$ 0,01", () => {
    renderizarFormulario();

    selecionarAtivo();
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Valor unitário (R$)"), {
      target: { value: "100,00" },
    });
    fireEvent.change(screen.getByLabelText("Custos (R$)"), { target: { value: "3,00" } });

    expect(screen.getByLabelText("Valor total (R$)")).toHaveValue("1.003,00");
    expect(screen.getByText("R$ 1.003,00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Valor total (R$)"), {
      target: { value: "1.005,00" },
    });

    expect(
      screen.getByText(
        "O valor total informado difere do calculado em R$ 2,00. A observação é obrigatória para salvar.",
      ),
    ).toBeInTheDocument();
  });

  it("exige observação quando o total diverge e não envia sem ela", () => {
    renderizarFormulario();

    preencherCompra("1.005,00");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      screen.getByText(
        "Informe uma observação explicando a diferença entre o valor total e o calculado.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Observações")).toHaveAttribute("aria-invalid", "true");
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("envia o corpo do contrato com observação quando o total diverge", async () => {
    apiRequestMock.mockImplementation(async () => ({
      ok: true as const,
      status: 201,
      data: CRIADA,
    }));
    const props = renderizarFormulario();

    preencherCompra("1.005,00");
    fireEvent.change(screen.getByLabelText("Observações"), {
      target: { value: "Diferença da nota de corretagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(props.onCriada).toHaveBeenCalledWith(CRIADA));

    const chamada = apiRequestMock.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(chamada?.[0]).toBe("/api/movimentacoes");
    expect(chamada?.[1]?.body).toEqual({
      ativoId: "a1",
      tipo: "COMPRA",
      data: (screen.getByLabelText("Data") as HTMLInputElement).value,
      quantidade: "10.00000000",
      valorUnitario: "100.00",
      valorTotal: "1005.00",
      custos: "3.00",
      observacoes: "Diferença da nota de corretagem",
    });
  });

  it("abre o diálogo de posição negativa com o impacto e reenvia com motivo", async () => {
    apiRequestMock
      .mockImplementationOnce(async () => ({
        ok: false as const,
        status: 409,
        error: {
          code: "MOV_POSICAO_NEGATIVA",
          message: "A movimentação deixaria a posição negativa.",
          details: {
            quantidadeAtual: "5.00000000",
            quantidadeSolicitada: "10.00000000",
            quantidadeResultante: "-5.00000000",
            requerConfirmacao: true,
          },
        },
      }))
      .mockImplementationOnce(async () => ({
        ok: true as const,
        status: 201,
        data: CRIADA,
      }));
    const props = renderizarFormulario();

    selecionarAtivo();
    fireEvent.click(screen.getByRole("radio", { name: "Venda" }));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Valor unitário (R$)"), {
      target: { value: "100,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Posição ficaria negativa")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar venda" }));
    expect(screen.getByText("Informe o motivo.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Motivo da confirmação"), {
      target: { value: "Ajuste de carteira" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venda" }));

    await waitFor(() => expect(props.onCriada).toHaveBeenCalledWith(CRIADA));

    const segundaChamada = apiRequestMock.mock.calls.filter(
      ([, options]) => options?.method === "POST",
    )[1];
    expect(segundaChamada?.[1]?.body).toMatchObject({
      ativoId: "a1",
      tipo: "VENDA",
      confirmarPosicaoNegativa: true,
      motivo: "Ajuste de carteira",
    });
  });

  it("não oferece tipos de renda fixa e explica onde registrá-los", () => {
    renderizarFormulario();

    expect(screen.queryByRole("radio", { name: "Aplicação RF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Resgate RF" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/use o cadastro de renda fixa/i),
    ).toBeInTheDocument();
  });
});
