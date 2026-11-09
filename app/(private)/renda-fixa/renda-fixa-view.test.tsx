import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { RendaFixaView } from "./renda-fixa-view";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const TITULO_CDB = {
  id: "rf-1",
  instituicao: "Banco X",
  produto: "CDB" as const,
  indexador: "POS_CDI" as const,
  taxa: "12.500000",
  dataAplicacao: "2026-01-10",
  vencimento: "2028-01-10",
  valorAplicado: "10000.00",
  saldoAtual: "10450.00",
  statusSaldo: "ESTIMADO" as const,
  liquidez: "NO_VENCIMENTO" as const,
  carenciaAte: null,
  coberturaFgc: true,
  observacoes: null,
  criadoEm: "2026-11-09T12:00:00.000Z",
  atualizadoEm: "2026-11-09T12:00:00.000Z",
};

const TITULO_TESOURO = {
  ...TITULO_CDB,
  id: "rf-2",
  instituicao: "Tesouro Nacional",
  produto: "TESOURO_SELIC" as const,
  indexador: "SELIC" as const,
  taxa: "0.100000",
  dataAplicacao: "2026-10-01",
  vencimento: "2026-11-29",
  valorAplicado: "5000.00",
  saldoAtual: "5000.00",
  statusSaldo: "INFORMADO" as const,
  liquidez: "DIARIA" as const,
  coberturaFgc: false,
};

const LISTA = {
  ok: true as const,
  status: 200,
  data: {
    data: [TITULO_CDB, TITULO_TESOURO],
    meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  },
};

const ALERTAS = {
  ok: true as const,
  status: 200,
  data: {
    alertas: [
      {
        tipo: "VENCIMENTO_PROXIMO" as const,
        tituloFixoId: "rf-2",
        mensagem: "Vence em 20 dia(s).",
        severidade: "ATENCAO" as const,
      },
    ],
  },
};

const ALERTAS_VAZIOS = {
  ok: true as const,
  status: 200,
  data: { alertas: [] },
};

function responderLista(overrides: Partial<typeof LISTA> = {}) {
  return { ...LISTA, ...overrides };
}

function mockPadrao() {
  apiRequestMock.mockImplementation(async (caminho) => {
    if (caminho.startsWith("/api/renda-fixa/alertas")) {
      return ALERTAS;
    }
    return responderLista();
  });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("RendaFixaView", () => {
  it("exibe a faixa de alertas com contagem por severidade e marca a linha", async () => {
    mockPadrao();
    render(<RendaFixaView />);

    const tabela = await screen.findByRole("table");

    expect(screen.getByText("Atenção: 1")).toBeInTheDocument();
    expect(screen.getByText("Crítico: 0")).toBeInTheDocument();
    expect(screen.getByText("Informação: 0")).toBeInTheDocument();
    expect(screen.getByText("Vence em 20 dia(s).")).toBeInTheDocument();
    expect(within(tabela).getByText("Vencimento próximo")).toBeInTheDocument();
    expect(within(tabela).getByText("Sem alerta")).toBeInTheDocument();
  });

  it("marca o saldo estimado com badge âmbar e título textual (RN-059)", async () => {
    mockPadrao();
    render(<RendaFixaView />);

    const tabela = await screen.findByRole("table");

    expect(within(tabela).getByText("Estimado")).toBeInTheDocument();
    expect(
      within(tabela).getByTitle("Estimado — não é valor oficial"),
    ).toBeInTheDocument();
  });

  it('filtra "somente com alerta" pelos IDs do endpoint de alertas', async () => {
    mockPadrao();
    render(<RendaFixaView />);

    const tabela = await screen.findByRole("table");
    expect(within(tabela).getByText("Banco X")).toBeInTheDocument();
    expect(within(tabela).getByText("Tesouro Nacional")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Somente com alerta"));

    await waitFor(() => {
      const atual = screen.queryByRole("table");
      expect(atual).not.toBeNull();
      expect(within(atual as HTMLElement).queryByText("Banco X")).not.toBeInTheDocument();
    });

    const tabelaFiltrada = screen.getByRole("table");
    expect(within(tabelaFiltrada).getByText("Tesouro Nacional")).toBeInTheDocument();
    expect(screen.getByText("1 de 2 títulos com alerta.")).toBeInTheDocument();

    const ultimaConsulta = apiRequestMock.mock.calls
      .map(([caminho]) => caminho)
      .filter((caminho) => caminho.startsWith("/api/renda-fixa?"))
      .at(-1);
    expect(ultimaConsulta).toContain("pageSize=100");
  });

  it("aplica o filtro de instituição na consulta", async () => {
    mockPadrao();
    render(<RendaFixaView />);
    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: "Banco X" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    await waitFor(() => {
      const consulta = apiRequestMock.mock.calls
        .map(([caminho]) => caminho)
        .filter((caminho) => caminho.startsWith("/api/renda-fixa?"))
        .at(-1);
      expect(consulta).toContain("instituicao=Banco+X");
    });
  });

  it("atualiza saldo e status pelo diálogo com feedback de sucesso", async () => {
    const atualizado = {
      ...TITULO_CDB,
      saldoAtual: "11000.00",
      statusSaldo: "CONFIRMADO" as const,
    };

    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho.startsWith("/api/renda-fixa/alertas")) {
        return ALERTAS;
      }
      if (options?.method === "PATCH") {
        return { ok: true as const, status: 200, data: atualizado };
      }
      return responderLista();
    });

    render(<RendaFixaView />);
    const tabela = await screen.findByRole("table");

    fireEvent.click(
      within(tabela).getByRole("button", { name: /Atualizar saldo de Banco X/ }),
    );

    const dialogo = await screen.findByRole("dialog");
    const saldo = within(dialogo).getByLabelText("Saldo atual (R$)");
    fireEvent.change(saldo, { target: { value: "11.000,00" } });
    fireEvent.change(within(dialogo).getByLabelText("Status do saldo"), {
      target: { value: "CONFIRMADO" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar saldo" }));

    expect(await screen.findByText("Saldo atualizado.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const chamada = apiRequestMock.mock.calls.find(([, options]) => options?.method === "PATCH");
    expect(chamada?.[0]).toBe("/api/renda-fixa/rf-1");
    expect(chamada?.[1]?.body).toEqual({
      saldoAtual: "11000.00",
      statusSaldo: "CONFIRMADO",
    });

    expect(within(tabela).getByText("R$ 11.000,00")).toBeInTheDocument();
    expect(within(tabela).getByText("Confirmado")).toBeInTheDocument();
  });

  it("mostra o estado vazio com CTA de cadastro e abre o formulário", async () => {
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/renda-fixa/alertas")) {
        return ALERTAS_VAZIOS;
      }
      return responderLista({
        data: {
          data: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
      });
    });

    render(<RendaFixaView />);

    expect(await screen.findByText("Nenhum título cadastrado")).toBeInTheDocument();
    const botoes = screen.getAllByRole("button", { name: "Cadastrar título" });
    expect(botoes).toHaveLength(2);

    fireEvent.click(botoes[1]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Cadastrar título" }),
    ).toBeInTheDocument();
  });

  it("ordena e pagina pelo servidor respeitando sort e order", async () => {
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/renda-fixa/alertas")) {
        return ALERTAS_VAZIOS;
      }
      return responderLista({
        data: {
          data: [TITULO_CDB, TITULO_TESOURO],
          meta: { page: 1, pageSize: 20, total: 40, totalPages: 2 },
        },
      });
    });

    render(<RendaFixaView />);
    const tabela = await screen.findByRole("table");

    const ultimaConsulta = () =>
      apiRequestMock.mock.calls
        .map(([caminho]) => caminho)
        .filter((caminho) => caminho.startsWith("/api/renda-fixa?"))
        .at(-1) ?? "";

    fireEvent.click(within(tabela).getByRole("button", { name: /Ordenar por Instituição/i }));
    await waitFor(() => expect(ultimaConsulta()).toContain("sort=instituicao"));
    expect(ultimaConsulta()).toContain("order=asc");

    const tabelaReordenada = await screen.findByRole("table");
    fireEvent.click(
      within(tabelaReordenada).getByRole("button", { name: /Ordenar por Instituição/i }),
    );
    await waitFor(() => expect(ultimaConsulta()).toContain("order=desc"));

    await screen.findByRole("table");
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(ultimaConsulta()).toContain("page=2"));
  });

  it("mostra o erro da lista com traceId e permite tentar novamente", async () => {
    let chamadasDeLista = 0;
    apiRequestMock.mockImplementation(async (caminho) => {
      if (caminho.startsWith("/api/renda-fixa/alertas")) {
        return ALERTAS_VAZIOS;
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
      return responderLista();
    });

    render(<RendaFixaView />);

    expect(await screen.findByText("trace-123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    const tabela = await screen.findByRole("table");
    expect(within(tabela).getByText("Banco X")).toBeInTheDocument();
  });
});
