import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/src/lib/api-client";
import { CadastroForm } from "./cadastro-form";

vi.mock("@/src/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const apiRequestMock = vi.mocked(apiRequest);

function preencherFormulario() {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Titular Teste" } });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "titular@exemplo.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "SenhaForte123!" } });
  fireEvent.change(screen.getByLabelText("Confirmação de senha"), {
    target: { value: "SenhaForte123!" },
  });
  fireEvent.click(screen.getByLabelText(/Termos de Uso/));
  fireEvent.click(screen.getByLabelText(/Política de Privacidade/));
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("CadastroForm", () => {
  it("mantém o botão desabilitado até os dois aceites", () => {
    render(<CadastroForm />);
    const botao = screen.getByRole("button", { name: "Criar conta" });

    expect(botao).toBeDisabled();
    expect(screen.getByText(/Aceite os dois documentos/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Termos de Uso/));
    expect(botao).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Política de Privacidade/));
    expect(botao).toBeEnabled();
    expect(screen.queryByText(/Aceite os dois documentos/)).not.toBeInTheDocument();
  });

  it("preserva os dados e marca o campo no erro 422 do servidor", async () => {
    apiRequestMock.mockResolvedValue({
      ok: false,
      status: 422,
      error: {
        code: "VALIDACAO",
        message: "Um ou mais campos são inválidos.",
        details: { errors: [{ field: "email", message: "Informe um e-mail válido." }] },
      },
    });

    render(<CadastroForm />);
    preencherFormulario();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    });

    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveValue("titular@exemplo.com");
    expect(email).toHaveFocus();
    expect(screen.getByLabelText("Nome")).toHaveValue("Titular Teste");
  });

  it("mostra a confirmação de e-mail após o cadastro", async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "id", email: "titular@exemplo.com", statusConta: "PENDENTE_VERIFICACAO" },
    });

    render(<CadastroForm />);
    preencherFormulario();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText(/Confirme seu e-mail/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
