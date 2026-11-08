import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextField } from "./text-field";

describe("TextField", () => {
  it("associa o rótulo ao input", () => {
    render(<TextField label="E-mail" name="email" />);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });

  it("expõe erro por aria-invalid e aria-describedby", () => {
    render(<TextField label="E-mail" error="Informe um e-mail válido." hint="Use o e-mail da conta." />);

    const input = screen.getByLabelText("E-mail");
    const erro = screen.getByText("Informe um e-mail válido.");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(erro.id);
    expect(input.getAttribute("aria-describedby")).toContain(
      screen.getByText("Use o e-mail da conta.").id,
    );
  });

  it("não marca aria-invalid quando não há erro", () => {
    render(<TextField label="E-mail" />);

    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-invalid");
  });
});
