import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("associa rótulo, alterna e associa erro", () => {
    function Exemplo() {
      const [aceito, setAceito] = useState(false);
      return (
        <Checkbox
          label="Li e aceito os Termos de Uso"
          checked={aceito}
          onChange={(event) => setAceito(event.target.checked)}
          error="É necessário aceitar os termos."
        />
      );
    }

    render(<Exemplo />);

    const caixa = screen.getByLabelText("Li e aceito os Termos de Uso");
    const erro = screen.getByText("É necessário aceitar os termos.");

    expect(caixa).toHaveAttribute("aria-invalid", "true");
    expect(caixa.getAttribute("aria-describedby")).toBe(erro.id);
    fireEvent.click(caixa);
    expect(caixa).toBeChecked();
  });
});
