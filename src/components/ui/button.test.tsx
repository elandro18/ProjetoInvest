import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("fica desabilitado e anuncia ocupação durante o envio", () => {
    render(<Button carregando>Salvar</Button>);

    const botao = screen.getByRole("button", { name: "Salvar" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
  });

  it("usa type button por padrão para não submeter formulário sem intenção", () => {
    render(<Button>Cancelar</Button>);

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveAttribute("type", "button");
  });
});
