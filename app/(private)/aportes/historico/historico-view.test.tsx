import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import type {
  SugestaoDetalheApi,
  SugestaoHistoricoItemApi,
} from "@/src/modules/aportes/apresentacao";
import { HistoricoView } from "./historico-view";
import {
  consultaHistorico,
  ehSugestaoNaoEncontrada,
  formatarPercentual,
  mesclarDistribuicao,
  rotuloDecisaoHistorico,
} from "./historico-ui";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const ACEITA: SugestaoHistoricoItemApi = {
  id: "11111111-1111-4111-8111-111111111111",
  data: "2026-11-10T12:00:00.000Z",
  valorDisponivel: "1000.00",
  decisaoUsuario: "ACEITA",
  decisaoEm: "2026-11-10T12:05:00.000Z",
  resumo: { classe: [{ codigo: "RENDA_FIXA", valor: "1000.00" }] },
};

const SEM_DECISAO: SugestaoHistoricoItemApi = {
  id: "22222222-2222-4222-8222-222222222222",
  data: "2026-11-08T12:00:00.000Z",
  valorDisponivel: "500.00",
  decisaoUsuario: null,
  decisaoEm: null,
  resumo: { classe: [{ codigo: "FII", valor: "500.00" }] },
};

const DETALHE: SugestaoDetalheApi = {
  id: ACEITA.id,
  data: ACEITA.data,
  valorDisponivel: "1000.00",
  distribuicaoAtual: {
    classe: [
      { codigo: "RENDA_FIXA", percentual: "35.000000" },
      { codigo: "FII", percentual: "65.000000" },
    ],
    segmento: [{ codigo: "LOGISTICA", percentual: "40.000000" }],
  },
  distribuicaoSugerida: {
    classe: [
      {
        codigo: "RENDA_FIXA",
        valor: "1000.00",
        justificativa: "Renda Fixa está abaixo da meta e recebe R$ 1.000,00.",
      },
      {
        codigo: "FII",
        valor: "0.00",
        justificativa: "Fundos Imobiliários está acima da meta e não recebe aporte.",
      },
    ],
    segmento: [
      {
        codigo: "LOGISTICA",
        valor: "1000.00",
        justificativa: "Segmento logístico abaixo da meta.",
      },
      { codigo: "SHOPPING", valor: "0.00", justificativa: "Shopping sem aporte." },
    ],
  },
  ativosAvaliados: [
    {
      ativoId: "a-hglg",
      ticker: "HGLG11",
      nome: "CSHG Logística",
      classe: "FII",
      segmento: "LOGISTICA",
      classificacao: "ABAIXO_META_APTO_PARA_ESTUDO",
      checklist: {
        classeAbaixoMeta: true,
        segmentoAbaixoMeta: true,
        ativoJaNaCarteira: false,
        aumentaConcentracao: "INDISPONIVEL",
        dadosSuficientes: "INDISPONIVEL",
        atendeQualidade: "INDISPONIVEL",
        alertaRelevante: false,
        precoDentroParametros: "INDISPONIVEL",
      },
      motivos: ["Segmento logístico abaixo da meta."],
    },
  ],
  justificativas: ["A distribuição prioriza a classe mais distante da meta."],
  alertas: ["Nenhum limite de concentração configurado."],
  decisaoUsuario: "ACEITA",
  decisaoEm: ACEITA.decisaoEm,
  observacoes: "Vou aportar em dois passos.",
};

const DETALHE_SEM_DECISAO: SugestaoDetalheApi = {
  ...DETALHE,
  id: SEM_DECISAO.id,
  valorDisponivel: "500.00",
  decisaoUsuario: null,
  decisaoEm: null,
  observacoes: null,
};

function listaCom(itens: readonly SugestaoHistoricoItemApi[], total = itens.length) {
  return (page: number) => ({
    data: itens,
    meta: { page, pageSize: 20, total, totalPages: total === 0 ? 0 : Math.ceil(total / 20) },
  });
}

interface Configuracao {
  readonly itens?: readonly SugestaoHistoricoItemApi[];
  readonly total?: number;
  readonly detalhe?: SugestaoDetalheApi | null;
  readonly detalheStatus?: number;
  readonly detalheCodigo?: string;
  readonly falhasDeLista?: number;
}

function configurarApi(configuracao: Configuracao = {}) {
  const itens = configuracao.itens ?? [ACEITA, SEM_DECISAO];
  const pagina = listaCom(itens, configuracao.total ?? itens.length);
  let falhasRestantes = configuracao.falhasDeLista ?? 0;

  apiRequestMock.mockImplementation(async (caminho) => {
    if (caminho.startsWith("/api/aportes/historico?")) {
      if (falhasRestantes > 0) {
        falhasRestantes -= 1;
        return {
          ok: false as const,
          status: 500,
          error: { code: "ERRO_INTERNO", message: "Algo deu errado." },
        };
      }
      const page = Number(new URL(caminho, "http://interno.local").searchParams.get("page") ?? "1");
      return { ok: true as const, status: 200, data: pagina(page) };
    }

    if (caminho.startsWith("/api/aportes/")) {
      if (configuracao.detalheStatus !== undefined) {
        return {
          ok: false as const,
          status: configuracao.detalheStatus,
          error: {
            code: configuracao.detalheCodigo ?? "ERRO_INTERNO",
            message: "Sugestão indisponível.",
          },
        };
      }
      if (configuracao.detalhe === null) {
        return {
          ok: false as const,
          status: 404,
          error: { code: "APORTE_NAO_ENCONTRADO", message: "Sugestão não encontrada." },
        };
      }
      if (caminho === `/api/aportes/${SEM_DECISAO.id}`) {
        return { ok: true as const, status: 200, data: DETALHE_SEM_DECISAO };
      }
      return { ok: true as const, status: 200, data: configuracao.detalhe ?? DETALHE };
    }

    return {
      ok: false as const,
      status: 500,
      error: { code: "ERRO_INTERNO", message: "Algo deu errado." },
    };
  });
}

function caminhosChamados(): string[] {
  return apiRequestMock.mock.calls.map(([caminho]) => caminho);
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("HistoricoView", () => {
  it("lista as sugestões com decisão registrada e marca as sem decisão", async () => {
    configurarApi();
    render(<HistoricoView />);

    await screen.findAllByText("R$ 1.000,00");

    expect(screen.getAllByText("Aceita").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem decisão").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Renda Fixa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fundos Imobiliários").length).toBeGreaterThan(0);
    expect(caminhosChamados()[0]).toBe("/api/aportes/historico?page=1&pageSize=20");
  });

  it("dispara a query com decisão e período ao filtrar", async () => {
    configurarApi();
    render(<HistoricoView />);

    await screen.findAllByText("Aceita");

    fireEvent.change(screen.getByLabelText("Decisão"), { target: { value: "IGNORADA" } });

    await waitFor(() =>
      expect(caminhosChamados()).toContain(
        "/api/aportes/historico?page=1&pageSize=20&decisao=IGNORADA",
      ),
    );

    fireEvent.change(screen.getByLabelText("Período — de"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("Período — até"), {
      target: { value: "2026-11-30" },
    });

    await waitFor(() =>
      expect(caminhosChamados()).toContain(
        "/api/aportes/historico?page=1&pageSize=20&de=2026-11-01&ate=2026-11-30&decisao=IGNORADA",
      ),
    );
  });

  it("pagina usando o meta devolvido pela API", async () => {
    configurarApi({ total: 45 });
    render(<HistoricoView />);

    await screen.findAllByText(/Página 1 de 3/);

    fireEvent.click(screen.getAllByRole("button", { name: "Próxima" })[0]);

    await waitFor(() =>
      expect(caminhosChamados()).toContain("/api/aportes/historico?page=2&pageSize=20"),
    );
    expect(await screen.findAllByText(/Página 2 de 3/)).not.toHaveLength(0);
  });

  it("abre o detalhe com o snapshot e sem nenhuma ação de decisão", async () => {
    configurarApi();
    render(<HistoricoView />);

    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhe da sugestão de 10\/11\/2026/,
    });
    fireEvent.click(botoes[0]);

    const dialogo = await screen.findByRole("dialog", { name: "Detalhe da sugestão" });
    expect(
      await within(dialogo).findByText("Sugestão de R$ 1.000,00"),
    ).toBeInTheDocument();

    expect(within(dialogo).getByText("Somente leitura")).toBeInTheDocument();
    expect(within(dialogo).getByText("Aceita")).toBeInTheDocument();
    expect(within(dialogo).getByText("Vou aportar em dois passos.")).toBeInTheDocument();

    // Distribuição atual × sugerida por classe e por segmento.
    expect(within(dialogo).getAllByText("35,00%").length).toBeGreaterThan(0);
    expect(
      within(dialogo).getAllByText(/Renda Fixa está abaixo da meta/).length,
    ).toBeGreaterThan(0);
    expect(within(dialogo).getByText("Distribuição por segmento")).toBeInTheDocument();
    expect(within(dialogo).getAllByText("40,00%").length).toBeGreaterThan(0);

    // Ativos avaliados com classificação, motivos e checklist.
    expect(within(dialogo).getByText("HGLG11 — CSHG Logística")).toBeInTheDocument();
    expect(within(dialogo).getByText("Abaixo da meta — apto para estudo")).toBeInTheDocument();
    expect(within(dialogo).getByText("Classe abaixo da meta")).toBeInTheDocument();
    expect(within(dialogo).getAllByText("não avaliado").length).toBeGreaterThan(0);

    // Justificativas e alertas.
    expect(
      within(dialogo).getByText("A distribuição prioriza a classe mais distante da meta."),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText("Nenhum limite de concentração configurado."),
    ).toBeInTheDocument();

    // Somente leitura: nenhuma ação de decisão.
    expect(within(dialogo).queryByRole("button", { name: "Aceitar" })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("button", { name: "Ignorar" })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("button", { name: "Alterar" })).not.toBeInTheDocument();

    expect(caminhosChamados()).toContain(`/api/aportes/${ACEITA.id}`);
    expect(within(dialogo).getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThan(0);
  });

  it("mostra 'Sem decisão' no detalhe quando nenhuma decisão foi registrada", async () => {
    configurarApi();
    render(<HistoricoView />);

    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhe da sugestão de 08\/11\/2026/,
    });
    fireEvent.click(botoes[0]);

    const dialogo = await screen.findByRole("dialog", { name: "Detalhe da sugestão" });
    expect(await within(dialogo).findByText("Sugestão de R$ 500,00")).toBeInTheDocument();
    expect(within(dialogo).getByText("Sem decisão")).toBeInTheDocument();
    expect(within(dialogo).getByText("Nenhuma observação registrada.")).toBeInTheDocument();
    expect(within(dialogo).queryByText(/registrada em/)).not.toBeInTheDocument();
  });

  it("mostra 404 quando o detalhe não existe ou é de outro titular", async () => {
    configurarApi({ detalhe: null });
    render(<HistoricoView />);

    const botoes = await screen.findAllByRole("button", { name: /Ver detalhe/ });
    fireEvent.click(botoes[0]);

    const dialogo = await screen.findByRole("dialog", { name: "Detalhe da sugestão" });
    expect(await within(dialogo).findByText("Sugestão não encontrada")).toBeInTheDocument();
    expect(
      within(dialogo).getByText("Esta sugestão não existe ou não pertence à sua conta."),
    ).toBeInTheDocument();
    expect(
      within(dialogo).queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
  });

  it("distingue histórico vazio de filtro sem resultado", async () => {
    configurarApi({ itens: [], total: 0 });
    render(<HistoricoView />);

    expect(await screen.findByText("Nenhuma sugestão registrada")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Decisão"), { target: { value: "IGNORADA" } });

    expect(await screen.findByText("Nenhuma sugestão no período")).toBeInTheDocument();
  });

  it("mostra erro com retry e recupera a lista", async () => {
    configurarApi({ falhasDeLista: 1 });
    render(<HistoricoView />);

    expect(
      await screen.findByText("Não foi possível carregar o histórico"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findAllByText("Aceita")).not.toHaveLength(0);
    expect(
      screen.queryByText("Não foi possível carregar o histórico"),
    ).not.toBeInTheDocument();
  });
});

describe("historico-ui", () => {
  it("monta a query com os filtros preenchidos e omite os vazios", () => {
    expect(consultaHistorico({ de: "", ate: "", decisao: "" }, 1)).toBe(
      "/api/aportes/historico?page=1&pageSize=20",
    );
    expect(
      consultaHistorico({ de: "2026-11-01", ate: "2026-11-30", decisao: "ALTERADA" }, 3),
    ).toBe(
      "/api/aportes/historico?page=3&pageSize=20&de=2026-11-01&ate=2026-11-30&decisao=ALTERADA",
    );
  });

  it("trata decisão ausente como 'Sem decisão'", () => {
    expect(rotuloDecisaoHistorico(null)).toEqual({ texto: "Sem decisão", tone: "neutral" });
    expect(rotuloDecisaoHistorico("ACEITA")).toEqual({ texto: "Aceita", tone: "success" });
    expect(rotuloDecisaoHistorico("IGNORADA")).toEqual({ texto: "Ignorada", tone: "neutral" });
    expect(rotuloDecisaoHistorico("ALTERADA")).toEqual({ texto: "Alterada", tone: "info" });
  });

  it("mescla distribuição atual e sugerida preservando a ordem da sugestão", () => {
    const linhas = mesclarDistribuicao(
      [
        { codigo: "FII", percentual: "65.000000" },
        { codigo: "CAIXA_OPORTUNIDADES", percentual: "5.000000" },
      ],
      [
        { codigo: "RENDA_FIXA", valor: "1000.00", justificativa: "Abaixo da meta." },
        { codigo: "FII", valor: "0.00", justificativa: "Acima da meta." },
      ],
    );

    expect(linhas.map((linha) => linha.codigo)).toEqual([
      "RENDA_FIXA",
      "FII",
      "CAIXA_OPORTUNIDADES",
    ]);
    expect(linhas[0]).toMatchObject({
      rotulo: "Renda Fixa",
      percentualAtual: null,
      valorSugerido: "1000.00",
      justificativa: "Abaixo da meta.",
    });
    expect(linhas[2]).toMatchObject({
      percentualAtual: "5.000000",
      valorSugerido: null,
      justificativa: null,
    });
  });

  it("omite linhas zeradas no recorte por segmento", () => {
    const linhas = mesclarDistribuicao(
      [{ codigo: "LOGISTICA", percentual: "40.000000" }],
      [
        { codigo: "LOGISTICA", valor: "1000.00", justificativa: "Abaixo da meta." },
        { codigo: "SHOPPING", valor: "0.00", justificativa: "Acima da meta." },
        { codigo: "LAJES", valor: "0.00", justificativa: "Sem dados." },
      ],
      false,
    );

    expect(linhas.map((linha) => linha.codigo)).toEqual(["LOGISTICA"]);
  });

  it("formata percentual com sinal de unidade", () => {
    expect(formatarPercentual("35.000000")).toBe("35,00%");
    expect(formatarPercentual("nao-numero")).toBe("Indisponível");
  });

  it("reconhece o 404 unificado do detalhe", () => {
    expect(ehSugestaoNaoEncontrada(404, "ERRO_INTERNO")).toBe(true);
    expect(ehSugestaoNaoEncontrada(500, "APORTE_NAO_ENCONTRADO")).toBe(true);
    expect(ehSugestaoNaoEncontrada(500, "ERRO_INTERNO")).toBe(false);
  });
});
