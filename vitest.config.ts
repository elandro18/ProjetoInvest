import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Configuração de testes unitários/integração (RN-001-6).
 *
 * Dois projetos:
 * - `node`: domínio puro (`src/lib`, `src/modules`) e infraestrutura;
 * - `ui`: componentes React, em `jsdom`, via Testing Library.
 *
 * Gates de cobertura espelham `quality/TEST_STRATEGY.md` §4:
 * global 75% de linhas; `src/modules/**` 90% linhas e 85% branches.
 */

const rootDir = path.resolve(__dirname);

const alias = {
  "@": rootDir,
};

const sharedResolve = { alias };

export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: sharedResolve,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["app/**/*.test.tsx", "src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      // Barrels de reexportação não têm comportamento próprio para medir.
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.d.ts", "src/**/index.ts"],
      thresholds: {
        lines: 75,
        "src/modules/**": {
          lines: 90,
          branches: 85,
        },
      },
    },
  },
});
