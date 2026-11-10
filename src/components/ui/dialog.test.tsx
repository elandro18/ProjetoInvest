import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

describe("Dialog", () => {
  it("renderiza como diálogo modal e foca o campo inicial", () => {
    render(
      <Dialog open title="Confirmar encerramento" onClose={vi.fn()} initialFocusId="campo-senha">
        <input id="campo-senha" aria-label="Senha atual" />
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Confirmar encerramento" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByLabelText("Senha atual")).toHaveFocus();
  });

  it("cancela com Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Confirmar" onClose={onClose}>
        <p>Conteúdo</p>
      </Dialog>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("aceita painel largo para conteúdo de leitura longa", () => {
    render(
      <Dialog open size="lg" title="Detalhe da sugestão" onClose={vi.fn()}>
        <p>Conteúdo</p>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Detalhe da sugestão" })).toHaveClass("max-w-3xl");
  });

  it("prende o foco entre o primeiro e o último focável", () => {
    render(
      <Dialog open title="Confirmar" onClose={vi.fn()} footer={<button type="button">Enviar</button>}>
        <button type="button">Cancelar</button>
      </Dialog>,
    );

    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    const enviar = screen.getByRole("button", { name: "Enviar" });
    const fechar = screen.getByRole("button", { name: "Fechar" });

    fechar.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(enviar).toHaveFocus();

    enviar.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(fechar).toHaveFocus();

    cancelar.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancelar).toHaveFocus();
  });
});
