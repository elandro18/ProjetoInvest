import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renderiza o título da fundação", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Investment Control" })).toBeInTheDocument();
  });

  it("explica que as telas chegam nas próximas features", () => {
    render(<Home />);

    expect(screen.getByText(/Fundação técnica em andamento/)).toBeInTheDocument();
  });
});
