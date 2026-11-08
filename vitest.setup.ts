import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Desmonta a árvore React entre testes para manter o DOM do jsdom isolado.
afterEach(() => {
  cleanup();
});
