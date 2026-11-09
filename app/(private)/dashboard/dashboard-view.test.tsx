import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { DashboardView } from "./dashboard-view";
import type { DashboardApi } from "./dashboard-ui";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const INDICADORES = {
  vazio: false,
  patrimonioTotal: "152340.00",
  totalInvestido: "140000.00",
  valorAtual: "152340.00",
  resultadoAcumulado: "19680.00",
  rendaMensal: "820.00",
  rendimentosAno: "7340.00",
  percentualRendaFixa: "40.041000",
  percentualFiis: "59.959000",
  meta: [
    {
      codigo: "RENDA_FIXA",
      atual: "40.041000",
      meta: "50.000000",
      desvio: "-9.959000",
      situacao: "ABAIXO" as const,
    },
    {
      codigo: "FII",
      atual: "59.959000",
      meta: "50.000000",
      desvio: "9.959000",
      situacao: "ACIMA" as const,
    },
  ],
};

const GRAFICOS = {
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
  evolucaoPatrimonial: [
    {
      data: "2026-10-31",
      patrimonio: "152340.00",
      rendaFixa: "61000.00",
      fiis: "91340.00",
    },
  ],
  evolucaoRendimentos: [{ mes: "2026-10", valor: "820.00" }],
  aportes: [],
  dividendos: [{ data: "2026-01-15", ativo: "HGLG11", valor: "80.00" }],
};

const OPORTUNIDADES = {
  classesAbaixo: [
    {
      escopo: "CLASSE" as const,
      codigo: "RENDA_FIXA",
      percentualAtual: "40.041000",
      percentualMeta: "50.000000",
      desvioPontos: "-9.959000",
      valorParaMeta: "10000.00",
    },
  ],
  segmentosAbaixo: [
    {
      escopo: "SEGMENTO" as const,
      codigo: "LOGISTICA",
      percentualAtual: "10.000000",
      percentualMeta: "25.000000",
      desvioPontos: "-15.000000",
      valorParaMeta: "20000.00",
    },
  ],
  watchlist: [],
  comAlerta: [],
  sugestaoAporte: null,
};

const COMPLETO: DashboardApi = {
  indicadores: INDICADORES,
  graficos: GRAFICOS,
  oportunidades: OPORTUNIDADES,
  erros: [],
};

const GRAFICOS_VAZIOS = {
  porClasse: [],
  porSegmento: [],
  evolucaoPatrimonial: [],
  evolucaoRendimentos: [
    { mes: "2026-09", valor: "0.00" },
    { mes: "2026-10", valor: "0.00" },
  ],
  aportes: [],
  dividendos: [],
};

function sucesso(data: DashboardApi) {
  return { ok: true as const, status: 200, data };
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("DashboardView", () => {
  it("renderiza os oito cards e a comparação com a meta", async () => {
    apiRequestMock.mockResolvedValue(sucesso(COMPLETO));

    render(<DashboardView />);

    expect(
      await screen.findByRole("heading", { name: "Resumo da carteira" }),
    ).toBeInTheDocument();

    const cardPatrimonio = screen.getByText("Patrimônio total").closest("div");
    expect(cardPatrimonio).not.toBeNull();
    expect(within(cardPatrimonio as HTMLElement).getByText("R$ 152.340,00")).toBeInTheDocument();

    const cardRendaFixa = screen.getByText("% em renda fixa").closest("div");
    expect(within(cardRendaFixa as HTMLElement).getByText("40,0%")).toBeInTheDocument();

    const cardResultado = screen.getByText("Resultado acumulado").closest("div");
    expect(within(cardResultado as HTMLElement).getByText("R$ 19.680,00")).toBeInTheDocument();
    expect(within(cardResultado as HTMLElement).getByText("Resultado positivo")).toBeInTheDocument();

    expect(
      screen.getByText("Renda fixa 40,0% · meta 50,0% · −10,0 p.p."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Abaixo da meta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Acima da meta")).toBeInTheDocument();
  });

  it("mostra a marca da meta 50/50 quando não há metas configuradas", async () => {
    apiRequestMock.mockResolvedValue(
      sucesso({ ...COMPLETO, indicadores: { ...INDICADORES, meta: [] } }),
    );

    render(<DashboardView />);

    expect(
      await screen.findByText("Renda fixa 40,0% · meta 50,0% · −10,0 p.p."),
    ).toBeInTheDocument();
    expect(screen.getByText("Fundos Imobiliários 60,0% · meta 50,0% · +10,0 p.p.")).toBeInTheDocument();
  });

  it("renderiza os quatro gráficos com tabela equivalente", async () => {
    apiRequestMock.mockResolvedValue(sucesso(COMPLETO));

    render(<DashboardView />);

    await screen.findByRole("heading", { name: "Gráficos" });
    expect(screen.getByRole("heading", { name: "Distribuição por classe" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Distribuição por segmento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evolução patrimonial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evolução dos rendimentos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Histórico de dividendos" })).toBeInTheDocument();

    expect(screen.getAllByRole("table")).toHaveLength(4);
    expect(screen.getAllByText("Ver dados em tabela")).toHaveLength(4);
    expect(screen.getByText("15/01/2026")).toBeInTheDocument();
    expect(screen.getByText("HGLG11")).toBeInTheDocument();
  });

  it("mostra estado de série vazia sem quebrar os gráficos", async () => {
    apiRequestMock.mockResolvedValue(
      sucesso({ ...COMPLETO, graficos: GRAFICOS_VAZIOS }),
    );

    render(<DashboardView />);

    expect(
      await screen.findByText("Ainda não há distribuição por classe para exibir."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ainda não há distribuição por segmento para exibir."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ainda não há evolução patrimonial para exibir.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum rendimento recebido nos últimos 12 meses.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum dividendo recebido ainda.")).toBeInTheDocument();
    expect(screen.queryAllByRole("table")).toHaveLength(0);
  });

  it("degrada por bloco e refaz somente o bloco com falha", async () => {
    apiRequestMock
      .mockResolvedValueOnce(
        sucesso({
          indicadores: INDICADORES,
          oportunidades: OPORTUNIDADES,
          erros: [
            {
              bloco: "graficos",
              code: "ERRO_INTERNO",
              message: "Não foi possível montar os gráficos.",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(sucesso(COMPLETO));

    render(<DashboardView />);

    expect(
      await screen.findByRole("heading", { name: "Resumo da carteira" }),
    ).toBeInTheDocument();
    // Faixa de alerta + bloco isolado, ambos anunciando o mesmo bloco.
    expect(screen.getAllByText("Gráficos indisponíveis").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Não foi possível montar os gráficos.").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("heading", { name: "Classes abaixo da meta" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Tentar novamente" })[0]!);

    expect(
      await screen.findByRole("heading", { name: "Distribuição por classe" }),
    ).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Resumo da carteira" })).toBeInTheDocument();
  });

  it("no primeiro acesso orienta o cadastro e não mostra zeros enganosos", async () => {
    apiRequestMock.mockResolvedValue(
      sucesso({
        indicadores: {
          ...INDICADORES,
          vazio: true,
          patrimonioTotal: "0.00",
          totalInvestido: "0.00",
          valorAtual: "0.00",
          resultadoAcumulado: "0.00",
          rendaMensal: "0.00",
          rendimentosAno: "0.00",
          percentualRendaFixa: "0.000000",
          percentualFiis: "0.000000",
          meta: [],
        },
        graficos: GRAFICOS_VAZIOS,
        oportunidades: {
          classesAbaixo: [],
          segmentosAbaixo: [],
          watchlist: [],
          comAlerta: [],
          sugestaoAporte: null,
        },
        erros: [],
      }),
    );

    render(<DashboardView />);

    expect(
      await screen.findByRole("heading", { name: "Comece pela sua carteira" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar primeiro ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
    expect(screen.getByRole("link", { name: "Cadastrar renda fixa" })).toHaveAttribute(
      "href",
      "/renda-fixa",
    );
    expect(screen.queryByText("Patrimônio total")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.getByText("Oportunidades após o primeiro cadastro")).toBeInTheDocument();
  });

  it("lista oportunidades com o valor necessário e os blocos em breve", async () => {
    apiRequestMock.mockResolvedValue(sucesso(COMPLETO));

    render(<DashboardView />);

    expect(
      await screen.findByRole("heading", { name: "Classes abaixo da meta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Segmentos abaixo da meta" })).toBeInTheDocument();
    expect(screen.getByText("Faltam R$ 10.000,00 para atingir a meta")).toBeInTheDocument();
    expect(screen.getByText("Faltam R$ 20.000,00 para atingir a meta")).toBeInTheDocument();
    expect(screen.getAllByText("Disponível em breve").length).toBeGreaterThanOrEqual(4);
    expect(
      screen.getByRole("heading", { name: "Sugestão de aporte do mês" }),
    ).toBeInTheDocument();
  });

  it("mostra erro completo com traceId e tenta novamente", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        error: {
          code: "BANCO_INDISPONIVEL",
          message: "Serviço temporariamente indisponível.",
          details: { traceId: "trace-123" },
        },
      })
      .mockResolvedValueOnce(sucesso(COMPLETO));

    render(<DashboardView />);

    expect(
      await screen.findByText("Serviço temporariamente indisponível."),
    ).toBeInTheDocument();
    expect(screen.getByText("trace-123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", { name: "Resumo da carteira" }),
    ).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it("oferece novo login quando a sessão expira", async () => {
    apiRequestMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "NAO_AUTENTICADO", message: "Não autenticado." },
    });

    render(<DashboardView />);

    expect(await screen.findByText("Sessão expirada")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Entrar novamente" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "/login?callbackUrl=%2Fdashboard");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });
});
