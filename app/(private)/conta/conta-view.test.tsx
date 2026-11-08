import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { ContaView } from "./conta-view";

const navegacao = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navegacao.replace, refresh: navegacao.refresh }),
}));

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

const SESSAO = {
  ok: true as const,
  status: 200,
  data: {
    usuario: {
      id: "id",
      nome: "Titular Teste",
      email: "titular@exemplo.com",
      statusConta: "ATIVA",
    },
    expiraEm: "2026-11-09T00:00:00.000Z",
  },
};

beforeEach(() => {
  navegacao.replace.mockReset();
  navegacao.refresh.mockReset();
  apiRequestMock.mockReset();
});

describe("ContaView", () => {
  it("carrega os dados do titular", async () => {
    apiRequestMock.mockResolvedValue(SESSAO);

    render(<ContaView />);

    expect(await screen.findByText("Titular Teste")).toBeInTheDocument();
    expect(screen.getByText("titular@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Encerrar conta" })).toBeInTheDocument();
  });

  it("abre o diálogo com foco na senha e cancela com ESC", async () => {
    apiRequestMock.mockResolvedValue(SESSAO);

    render(<ContaView />);
    await screen.findByText("Titular Teste");

    fireEvent.click(screen.getByRole("button", { name: "Encerrar conta" }));

    const dialogo = screen.getByRole("dialog", { name: "Confirmar encerramento" });
    expect(within(dialogo).getByLabelText("Senha atual")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra erro de senha e mantém o diálogo aberto", async () => {
    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho === "/api/conta" && options?.method === "DELETE") {
        return {
          ok: false,
          status: 401,
          error: { code: "AUTH_CREDENCIAIS_INVALIDAS", message: "E-mail ou senha inválidos." },
        };
      }
      return SESSAO;
    });

    render(<ContaView />);
    await screen.findByText("Titular Teste");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar conta" }));

    const dialogo = screen.getByRole("dialog", { name: "Confirmar encerramento" });
    fireEvent.change(within(dialogo).getByLabelText("Senha atual"), {
      target: { value: "senha-errada" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Encerrar conta" }));

    expect(await within(dialogo).findByText("E-mail ou senha inválidos.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(navegacao.replace).not.toHaveBeenCalled();
  });

  it("redireciona ao login após encerrar com a senha correta", async () => {
    apiRequestMock.mockImplementation(async (caminho, options) => {
      if (caminho === "/api/conta" && options?.method === "DELETE") {
        return {
          ok: true,
          status: 200,
          data: { statusConta: "EXCLUIDA", mensagem: "Conta encerrada." },
        };
      }
      return SESSAO;
    });

    render(<ContaView />);
    await screen.findByText("Titular Teste");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar conta" }));

    const dialogo = screen.getByRole("dialog", { name: "Confirmar encerramento" });
    fireEvent.change(within(dialogo).getByLabelText("Senha atual"), {
      target: { value: "SenhaForte123!" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Encerrar conta" }));

    await waitFor(() => {
      expect(navegacao.replace).toHaveBeenCalledWith("/login?conta=encerrada");
    });
    expect(navegacao.refresh).toHaveBeenCalled();
  });
});
