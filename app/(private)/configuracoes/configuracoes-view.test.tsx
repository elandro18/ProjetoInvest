import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";

import { ConfiguracoesView } from "./configuracoes-view";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const LIMITES_GET = {
  ok: true as const,
  status: 200,
  data: {
    vigente: [
      {
        dimensao: "ATIVO",
        referencia: null,
        percentualMax: "20.000000",
        vigenciaInicio: "2026-11-09",
      },
    ],
    historico: [],
  },
};

const PUT_OK = {
  ok: true as const,
  status: 200,
  data: {
    vigente: [
      {
        dimensao: "ATIVO",
        referencia: null,
        percentualMax: "20.000000",
        vigenciaInicio: "2026-11-09",
      },
    ],
  },
};

const CONCENTRACAO_EXCEDIDA = {
  ok: true as const,
  status: 200,
  data: {
    baseCalculo: "PATRIMONIO_TOTAL",
    dimensoes: [
      {
        dimensao: "ATIVO",
        disponivel: true,
        itens: [
          {
            referencia: "HGLG11",
            nome: "CSHG Logística",
            valor: "16235.00",
            percentual: "25.000000",
            limite: "20.000000",
            excedido: true,
            excessoPontos: "5.000000",
          },
        ],
      },
      { dimensao: "GESTORA", disponivel: true, itens: [] },
      { dimensao: "SEGMENTO", disponivel: true, itens: [] },
      { dimensao: "EMISSOR", disponivel: true, itens: [] },
      { dimensao: "IMOVEL", disponivel: false, itens: [] },
    ],
  },
};

const CONCENTRACAO_SEM_LIMITE = {
  ok: true as const,
  status: 200,
  data: {
    baseCalculo: "PATRIMONIO_TOTAL",
    dimensoes: [
      {
        dimensao: "ATIVO",
        disponivel: true,
        itens: [
          {
            referencia: "HGLG11",
            nome: "CSHG Logística",
            valor: "16235.00",
            percentual: "25.000000",
            limite: null,
            excedido: false,
            excessoPontos: "0.000000",
          },
        ],
      },
      { dimensao: "GESTORA", disponivel: true, itens: [] },
      { dimensao: "SEGMENTO", disponivel: true, itens: [] },
      { dimensao: "EMISSOR", disponivel: true, itens: [] },
      { dimensao: "IMOVEL", disponivel: false, itens: [] },
    ],
  },
};

const CONCENTRACAO_VAZIA = {
  ok: true as const,
  status: 200,
  data: {
    baseCalculo: "PATRIMONIO_TOTAL",
    dimensoes: [
      { dimensao: "ATIVO", disponivel: true, itens: [] },
      { dimensao: "GESTORA", disponivel: true, itens: [] },
      { dimensao: "SEGMENTO", disponivel: true, itens: [] },
      { dimensao: "EMISSOR", disponivel: true, itens: [] },
      { dimensao: "IMOVEL", disponivel: false, itens: [] },
    ],
  },
};

interface Respostas {
  readonly limitesGet?: () => unknown;
  readonly concentracaoGet?: () => unknown;
  readonly put?: (body: unknown) => unknown;
}

function montarMock(respostas: Respostas = {}) {
  apiRequestMock.mockImplementation(async (caminho, opcoes) => {
    if (caminho === "/api/configuracoes/limites") {
      if (opcoes?.method === "PUT") {
        return (respostas.put?.(opcoes.body) ?? PUT_OK) as never;
      }
      return (respostas.limitesGet?.() ?? LIMITES_GET) as never;
    }
    if (caminho === "/api/risco/concentracao") {
      return (respostas.concentracaoGet?.() ?? CONCENTRACAO_EXCEDIDA) as never;
    }
    throw new Error(`Rota inesperada no teste: ${caminho}`);
  });
}

async function renderizar() {
  render(<ConfiguracoesView />);
  await screen.findByLabelText("Percentual máximo do limite 1 (%)");
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("ConfiguracoesView", () => {
  it("adiciona e remove linhas de limite", async () => {
    montarMock();
    await renderizar();

    expect(screen.getAllByLabelText(/^Dimensão do limite \d+$/)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar limite" }));

    expect(screen.getAllByLabelText(/^Dimensão do limite \d+$/)).toHaveLength(2);
    expect(screen.getByLabelText("Referência do limite 2 (opcional)")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Remover limite 2" }));

    expect(screen.getAllByLabelText(/^Dimensão do limite \d+$/)).toHaveLength(1);
  });

  it("valida o percentual fora de 0–100, marca o campo e foca o primeiro erro", async () => {
    montarMock();
    await renderizar();

    const percentual = screen.getByLabelText("Percentual máximo do limite 1 (%)");
    fireEvent.change(percentual, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    expect(
      await screen.findByText("Informe um percentual maior que 0 e até 100."),
    ).toBeInTheDocument();
    expect(percentual).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(percentual).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.change(percentual, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    expect(
      await screen.findByText("Informe um percentual maior que 0 e até 100."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("recusa referência duplicada na mesma dimensão antes de enviar", async () => {
    montarMock();
    await renderizar();

    fireEvent.change(screen.getByLabelText("Referência do limite 1 (opcional)"), {
      target: { value: "HGLG11" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar limite" }));
    fireEvent.change(screen.getByLabelText("Referência do limite 2 (opcional)"), {
      target: { value: "hglg11" },
    });
    fireEvent.change(screen.getByLabelText("Percentual máximo do limite 2 (%)"), {
      target: { value: "20" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    expect(
      await screen.findByText("Já existe um limite para esta dimensão e referência."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mapeia o 422 RISCO_LIMITE_INVALIDO para o campo e preserva o valor digitado", async () => {
    montarMock({
      put: () => ({
        ok: false,
        status: 422,
        error: {
          code: "RISCO_LIMITE_INVALIDO",
          message: "Limite de concentração inválido.",
          details: { campo: "limites[0].percentualMax" },
        },
      }),
    });
    await renderizar();

    const percentual = screen.getByLabelText("Percentual máximo do limite 1 (%)");
    fireEvent.change(percentual, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar salvamento" }));

    expect(
      await screen.findByText("Limite inválido. Revise o campo destacado e tente novamente."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("O percentual deve ser maior que 0 e até 100."),
    ).toBeInTheDocument();
    expect(percentual).toHaveValue("20");
    expect(percentual).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(percentual).toHaveFocus());

    const chamadaPut = apiRequestMock.mock.calls.find(
      ([caminho, opcoes]) =>
        caminho === "/api/configuracoes/limites" && opcoes?.method === "PUT",
    );
    expect(chamadaPut?.[1]?.body).toEqual({
      limites: [{ dimensao: "ATIVO", referencia: null, percentualMax: "20.000000" }],
    });
  });

  it("mostra Excedido com o excesso em p.p. e o limite vigente", async () => {
    montarMock();
    await renderizar();

    expect((await screen.findAllByText("Excedido")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 p.p. acima do limite").length).toBeGreaterThan(0);
    expect(screen.getAllByText("25%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 16.235,00").length).toBeGreaterThan(0);
  });

  it("mostra o percentual sem badge quando o limite não está configurado", async () => {
    montarMock({ concentracaoGet: () => CONCENTRACAO_SEM_LIMITE });
    await renderizar();

    expect((await screen.findAllByText("Sem limite configurado")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("25%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Excedido")).not.toBeInTheDocument();
    expect(screen.queryByText("Dentro do limite")).not.toBeInTheDocument();
  });

  it("explica que IMOVEL está indisponível até a Fase 3/4", async () => {
    montarMock();
    await renderizar();

    expect(
      await screen.findByText("Indisponível até a Fase 3/4."),
    ).toBeInTheDocument();
  });

  it("mostra estado vazio explicativo quando a carteira não tem posições", async () => {
    montarMock({ concentracaoGet: () => CONCENTRACAO_VAZIA });
    await renderizar();

    expect(await screen.findByText("Carteira vazia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar ativo" })).toHaveAttribute(
      "href",
      "/ativos/novo",
    );
    expect(screen.queryByText("Excedido")).not.toBeInTheDocument();
  });

  it("remove todos os limites, salva o conjunto vazio e recarrega o painel sem badge", async () => {
    let chamadasConcentracao = 0;
    montarMock({
      concentracaoGet: () => {
        chamadasConcentracao += 1;
        return chamadasConcentracao === 1 ? CONCENTRACAO_EXCEDIDA : CONCENTRACAO_SEM_LIMITE;
      },
      put: () => ({ ok: true, status: 200, data: { vigente: [] } }),
    });
    await renderizar();

    expect((await screen.findAllByText("Excedido")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Remover limite 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    expect(await screen.findByText(/Nenhum limite ficará vigente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar salvamento" }));

    expect(
      await screen.findByText(/A configuração anterior foi preservada no histórico/),
    ).toBeInTheDocument();

    expect((await screen.findAllByText("Sem limite configurado")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("Excedido")).not.toBeInTheDocument());

    const chamadaPut = apiRequestMock.mock.calls.find(
      ([caminho, opcoes]) =>
        caminho === "/api/configuracoes/limites" && opcoes?.method === "PUT",
    );
    expect(chamadaPut?.[1]?.body).toEqual({ limites: [] });
  });

  it("oferece retry quando os limites falham no carregamento", async () => {
    let chamadasLimites = 0;
    montarMock({
      limitesGet: () => {
        chamadasLimites += 1;
        return chamadasLimites === 1
          ? {
              ok: false,
              status: 500,
              error: {
                code: "ERRO_INTERNO",
                message: "Erro inesperado. Tente novamente.",
              },
            }
          : LIMITES_GET;
      },
    });

    render(<ConfiguracoesView />);

    expect(
      await screen.findByText("Não foi possível carregar os limites"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByLabelText("Percentual máximo do limite 1 (%)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar os limites")).not.toBeInTheDocument();
  });
});
