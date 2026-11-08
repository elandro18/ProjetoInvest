import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { LoginForm } from "./login-form";

const navegacao = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navegacao.push, refresh: navegacao.refresh }),
}));

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

beforeEach(() => {
  navegacao.push.mockReset();
  navegacao.refresh.mockReset();
  apiRequestMock.mockReset();
});

describe("LoginForm", () => {
  it("mostra erro genérico e preserva o e-mail em credencial inválida", async () => {
    apiRequestMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "AUTH_CREDENCIAIS_INVALIDAS", message: "E-mail ou senha inválidos." },
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "titular@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail ou senha inválidos.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("titular@exemplo.com");
    expect(navegacao.push).not.toHaveBeenCalled();
  });

  it("redireciona para o callbackUrl interno após o login", async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        usuario: {
          id: "id",
          nome: "Titular",
          email: "titular@exemplo.com",
          statusConta: "ATIVA",
        },
      },
    });

    render(<LoginForm callbackUrl="/conta?aba=dados" />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "titular@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "SenhaForte123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(navegacao.push).toHaveBeenCalledWith("/conta?aba=dados");
    });
    expect(navegacao.refresh).toHaveBeenCalled();
  });

  it("usa /conta quando não há callbackUrl", async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        usuario: {
          id: "id",
          nome: "Titular",
          email: "titular@exemplo.com",
          statusConta: "ATIVA",
        },
      },
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "titular@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "SenhaForte123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(navegacao.push).toHaveBeenCalledWith("/conta");
    });
  });
});
