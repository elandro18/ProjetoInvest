import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import {
  exibirChecklist,
  linhasComAporte,
  semPatrimonio,
  somarDistribuicao,
  validarValorDisponivel,
  valorParaApi,
} from "./aportes-ui";
import { AportesView } from "./aportes-view";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const CHECKLIST_INDISPONIVEL = {
  classeAbaixoMeta: true,
  segmentoAbaixoMeta: true,
  ativoJaNaCarteira: false,
  aumentaConcentracao: "INDISPONIVEL",
  dadosSuficientes: "INDISPONIVEL",
  atendeQualidade: "INDISPONIVEL",
  alertaRelevante: false,
  precoDentroParametros: "INDISPONIVEL",
} as const;

const SUGESTAO = {
  ok: true as const,
  status: 201,
  data: {
    id: "11111111-1111-4111-8111-111111111111",
    data: "2026-11-10T12:00:00.000Z",
    valorDisponivel: "1000.00",
    distribuicaoAtual: {
      classe: [
        { codigo: "RENDA_FIXA", percentual: "35.000000" },
        { codigo: "FII", percentual: "65.000000" },
      ],
      segmento: [],
    },
    distribuicaoSugerida: {
      classe: [
        {
          codigo: "RENDA_FIXA",
          valor: "1000.00",
          justificativa:
            "Renda Fixa está 9,96 p.p. abaixo da meta e recebe R$ 1.000,00 (RN-027).",
        },
        {
          codigo: "FII",
          valor: "0.00",
          justificativa: "Fundos Imobiliários está acima da meta e não recebe aporte.",
        },
      ],
      segmento: [],
    },
    ativosAvaliados: [
      {
        ativoId: "a-hglg",
        ticker: "HGLG11",
        nome: "CSHG Logística",
        classe: "FII",
        segmento: "LOGISTICA",
        classificacao: "ABAIXO_META_APTO_PARA_ESTUDO",
        checklist: CHECKLIST_INDISPONIVEL,
        motivos: [],
      },
    ],
    justificativas: [],
    alertas: [
      "Nenhum limite de concentração configurado: a verificação de concentração fica indisponível.",
    ],
  },
};

const DECISAO_ACEITA = {
  ok: true as const,
  status: 200,
  data: {
    id: "11111111-1111-4111-8111-111111111111",
    decisaoUsuario: "ACEITA",
    decisaoEm: "2026-11-10T12:05:00.000Z",
    observacoes: "vou aportar metade",
  },
};

const DECISAO_IGNORADA = {
  ok: true as const,
  status: 200,
  data: {
    id: "11111111-1111-4111-8111-111111111111",
    decisaoUsuario: "IGNORADA",
    decisaoEm: "2026-11-10T12:06:00.000Z",
    observacoes: null,
  },
};

function mockApi(sugestao: unknown = SUGESTAO, decisao: unknown = DECISAO_ACEITA) {
  apiRequestMock.mockImplementation(async (caminho) => {
    if (caminho === "/api/aportes/sugestao") {
      return sugestao as never;
    }
    if (caminho.startsWith("/api/aportes/") && caminho.endsWith("/decisao")) {
      return decisao as never;
    }
    throw new Error(`Rota inesperada no teste: ${caminho}`);
  });
}

function preencherValor(valor: string) {
  fireEvent.change(screen.getByLabelText("Valor disponível (R$)"), { target: { value: valor } });
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: "Gerar sugestão" }));
}

async function gerarSugestao(valor = "1.000,00") {
  render(<AportesView hoje="2026-11-10" />);
  preencherValor(valor);
  enviar();
  await screen.findByRole("heading", { name: /Sugestão para/ });
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("AportesView — entrada e aviso", () => {
  it("mantém o aviso permanente de que a decisão é do titular", () => {
    render(<AportesView />);

    expect(screen.getByText("Sugestão de distribuição — a decisão é sua")).toBeInTheDocument();
    expect(
      screen.getByText(/O sistema não compra nem vende por você/),
    ).toBeInTheDocument();
  });

  it("preenche o valor pelos atalhos de 500, 1.000, 1.500 e 2.000", () => {
    render(<AportesView />);
    const campo = screen.getByLabelText("Valor disponível (R$)");

    for (const [rotulo, esperado] of [
      ["R$ 500", "500,00"],
      ["R$ 1.000", "1.000,00"],
      ["R$ 1.500", "1.500,00"],
      ["R$ 2.000", "2.000,00"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: rotulo }));
      expect(campo).toHaveValue(esperado);
    }
  });

  it("bloqueia valor vazio ou zero sem chamar a API", () => {
    render(<AportesView />);

    enviar();
    expect(screen.getByText("Informe o valor disponível (ex.: 1.000,00).")).toBeInTheDocument();

    preencherValor("0");
    enviar();
    expect(screen.getByText("O valor disponível deve ser maior que zero.")).toBeInTheDocument();

    preencherValor("abc");
    enviar();
    expect(screen.getByText("Informe um valor válido (ex.: 1.234,56).")).toBeInTheDocument();

    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("valida o valor no blur e limpa o erro ao digitar", () => {
    render(<AportesView />);
    const campo = screen.getByLabelText("Valor disponível (R$)");

    fireEvent.change(campo, { target: { value: "0" } });
    fireEvent.blur(campo);
    expect(screen.getByText("O valor disponível deve ser maior que zero.")).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "10" } });
    expect(
      screen.queryByText("O valor disponível deve ser maior que zero."),
    ).not.toBeInTheDocument();
  });
});

describe("AportesView — resultado da sugestão", () => {
  it("envia o valor do contrato e exibe a distribuição com justificativa", async () => {
    mockApi();
    await gerarSugestao();

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/aportes/sugestao",
      expect.objectContaining({
        method: "POST",
        body: { valorDisponivel: "1000.00", data: "2026-11-10" },
      }),
    );

    expect(
      screen.getAllByText(/Renda Fixa está 9,96 p.p. abaixo da meta e recebe R\$ 1.000,00/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Fundos Imobiliários está acima da meta/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Distribuição sugerida por classe" })).toBeInTheDocument();
  });

  it("mostra a distribuição por segmento quando o contrato devolve linhas", async () => {
    mockApi({
      ...SUGESTAO,
      data: {
        ...SUGESTAO.data,
        distribuicaoSugerida: {
          classe: SUGESTAO.data.distribuicaoSugerida.classe,
          segmento: [
            {
              codigo: "LOGISTICA",
              valor: "250.00",
              justificativa: "Logística está abaixo da meta e recebe R$ 250,00.",
            },
          ],
        },
      },
    });

    await gerarSugestao();

    expect(screen.getByRole("heading", { name: "Distribuição sugerida por segmento" })).toBeInTheDocument();
    expect(screen.getAllByText(/Logística está abaixo da meta/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Logística").length).toBeGreaterThan(0);
  });

  it("não lista segmentos zerados e explica que o detalhamento depende da parcela de FII", async () => {
    mockApi({
      ...SUGESTAO,
      data: {
        ...SUGESTAO.data,
        distribuicaoSugerida: {
          classe: SUGESTAO.data.distribuicaoSugerida.classe,
          segmento: [
            {
              codigo: "LOGISTICA",
              valor: "0.00",
              justificativa: "Logística está acima da meta e não recebe aporte.",
            },
          ],
        },
      },
    });

    await gerarSugestao();

    expect(
      screen.getByRole("heading", { name: "Distribuição sugerida por segmento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum valor foi direcionado aos segmentos neste aporte/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Logística está acima da meta/)).not.toBeInTheDocument();
  });

  it("exibe checklist com 'não avaliado' e explica o motivo quando o dado não existe", async () => {
    mockApi();
    await gerarSugestao();

    const dadosSuficientes = screen.getByText("Dados suficientes").closest("li");
    expect(dadosSuficientes).not.toBeNull();
    expect(within(dadosSuficientes as HTMLElement).getByText("não avaliado")).toBeInTheDocument();
    expect(within(dadosSuficientes as HTMLElement).queryByText("ok")).not.toBeInTheDocument();
    expect(within(dadosSuficientes as HTMLElement).getByText(/Fase 3/)).toBeInTheDocument();

    const concentracao = screen.getByText("Concentração dentro do limite").closest("li");
    expect(within(concentracao as HTMLElement).getByText("não avaliado")).toBeInTheDocument();
    expect(
      within(concentracao as HTMLElement).getByText(/Sem limite de concentração configurado/),
    ).toBeInTheDocument();

    expect(screen.getAllByText("não avaliado")).toHaveLength(4);
  });

  it("exibe a classificação e os dados do ativo para estudo", async () => {
    mockApi();
    await gerarSugestao();

    expect(screen.getByText("HGLG11 — CSHG Logística")).toBeInTheDocument();
    expect(screen.getByText("Fundos Imobiliários · Logística")).toBeInTheDocument();
    expect(screen.getByText("Abaixo da meta — apto para estudo")).toBeInTheDocument();
  });

  it("exibe os alertas da sugestão", async () => {
    mockApi();
    await gerarSugestao();

    expect(screen.getByText("Alertas da sugestão")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum limite de concentração configurado/)).toBeInTheDocument();
  });

  it("orienta a cadastrar ativo e renda fixa quando não há patrimônio", async () => {
    mockApi({
      ...SUGESTAO,
      data: {
        ...SUGESTAO.data,
        distribuicaoAtual: {
          classe: [
            { codigo: "RENDA_FIXA", percentual: "0.000000" },
            { codigo: "FII", percentual: "0.000000" },
          ],
          segmento: [],
        },
      },
    });

    await gerarSugestao();

    expect(screen.getByText("Sem patrimônio cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
    expect(screen.getByRole("link", { name: "Cadastrar renda fixa" })).toHaveAttribute(
      "href",
      "/renda-fixa",
    );
  });

  it("mostra estado vazio com CTA quando não há ativos avaliados", async () => {
    mockApi({
      ...SUGESTAO,
      data: {
        ...SUGESTAO.data,
        ativosAvaliados: [],
      },
    });

    await gerarSugestao();

    expect(screen.getByText("Nenhum ativo cadastrado para avaliar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
  });
});

describe("AportesView — decisão do usuário", () => {
  it("registra o aceite com observação e mantém a sugestão visível", async () => {
    mockApi();
    await gerarSugestao();

    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.change(within(dialogo).getByLabelText("Observação (opcional)"), {
      target: { value: "vou aportar metade" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar aceite" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/aportes/11111111-1111-4111-8111-111111111111/decisao",
        {
          method: "PATCH",
          body: { decisao: "ACEITA", observacoes: "vou aportar metade" },
        },
      ),
    );

    expect(await screen.findByText("Aceita")).toBeInTheDocument();
    expect(screen.getByText(/Decisão registrada: aceita/)).toBeInTheDocument();
    expect(screen.getByText(/Observação: vou aportar metade/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Renda Fixa está 9,96 p.p. abaixo da meta/).length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("registra o 'Ignorar' sem observação", async () => {
    mockApi(SUGESTAO, DECISAO_IGNORADA);
    await gerarSugestao();

    fireEvent.click(screen.getByRole("button", { name: "Ignorar" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar que ignorei" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/aportes/11111111-1111-4111-8111-111111111111/decisao",
        { method: "PATCH", body: { decisao: "IGNORADA" } },
      ),
    );

    expect(await screen.findByText("Ignorada")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Renda Fixa está 9,96 p.p. abaixo da meta/).length,
    ).toBeGreaterThan(0);
  });

  it("mostra erro dentro do diálogo quando a decisão falha", async () => {
    mockApi(SUGESTAO, {
      ok: false,
      status: 404,
      error: { code: "APORTE_NAO_ENCONTRADO", message: "Sugestão não encontrada." },
    });
    await gerarSugestao();

    fireEvent.click(screen.getByRole("button", { name: "Alterar" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar alteração" }));

    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Sugestão não encontrada.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("AportesView — estados de erro e carregamento", () => {
  it("orienta a configurar metas quando o servidor responde 409", async () => {
    mockApi({
      ok: false,
      status: 409,
      error: {
        code: "APORTE_DADOS_INSUFICIENTES",
        message: "Dados insuficientes para montar a sugestão.",
      },
    });

    render(<AportesView />);
    preencherValor("1.000,00");
    enviar();

    expect(await screen.findByText("Sem metas para calcular a sugestão")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar metas em /alocacao" })).toHaveAttribute(
      "href",
      "/alocacao",
    );
  });

  it("mostra erro com retry e recupera na nova tentativa", async () => {
    let tentativas = 0;
    apiRequestMock.mockImplementation(async () => {
      tentativas += 1;
      return tentativas === 1
        ? ({
            ok: false,
            status: 0,
            error: { code: "ERRO_REDE", message: "Não foi possível conectar." },
          } as never)
        : (SUGESTAO as never);
    });

    render(<AportesView />);
    preencherValor("1.000,00");
    enviar();

    expect(await screen.findByText("Não foi possível gerar a sugestão")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      (await screen.findAllByText(/Renda Fixa está 9,96 p.p. abaixo da meta/)).length,
    ).toBeGreaterThan(0);
  });
});

describe("aportes-ui", () => {
  it("lê o valor digitado em PT-BR e devolve a string do contrato", () => {
    expect(valorParaApi("1.000")).toBe("1000.00");
    expect(valorParaApi("1.000,50")).toBe("1000.50");
    expect(valorParaApi("1000.50")).toBe("1000.50");
    expect(valorParaApi("500")).toBe("500.00");
    expect(valorParaApi("")).toBeNull();
    expect(valorParaApi("abc")).toBeNull();
  });

  it("valida o valor disponível", () => {
    expect(validarValorDisponivel("")).toBe("Informe o valor disponível (ex.: 1.000,00).");
    expect(validarValorDisponivel("0")).toBe("O valor disponível deve ser maior que zero.");
    expect(validarValorDisponivel("-5")).toBe("Informe um valor válido (ex.: 1.234,56).");
    expect(validarValorDisponivel("10")).toBeNull();
  });

  it("converte o checklist do contrato em ok / não / não avaliado", () => {
    const itens = exibirChecklist(CHECKLIST_INDISPONIVEL);
    expect(itens).toHaveLength(8);

    const porChave = new Map(itens.map((item) => [item.chave, item] as const));
    expect(porChave.get("classeAbaixoMeta")?.valor).toBe("ok");
    expect(porChave.get("ativoJaNaCarteira")?.valor).toBe("não");
    expect(porChave.get("aumentaConcentracao")?.valor).toBe("não avaliado");
    expect(porChave.get("aumentaConcentracao")?.explicacao).toContain("Sem limite de concentração");
    expect(porChave.get("atendeQualidade")?.valor).toBe("não avaliado");
    expect(itens.some((item) => item.valor === "ok" && item.chave === "dadosSuficientes")).toBe(
      false,
    );
  });

  it("soma a distribuição e detecta a carteira sem patrimônio", () => {
    expect(somarDistribuicao(SUGESTAO.data.distribuicaoSugerida.classe)).toBe("1000.00");
    expect(
      linhasComAporte(SUGESTAO.data.distribuicaoSugerida.classe).map((linha) => linha.codigo),
    ).toEqual(["RENDA_FIXA"]);
    expect(semPatrimonio(SUGESTAO.data as never)).toBe(false);
    expect(
      semPatrimonio({
        ...SUGESTAO.data,
        distribuicaoAtual: { classe: [], segmento: [] },
      } as never),
    ).toBe(true);
  });
});
