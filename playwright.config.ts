import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de fundação (RN-001-6).
 *
 * O webServer sobe o build de produção em porta dedicada (3100) para não
 * conflitar com `npm run dev` local. No CI a suíte roda em job separado com
 * Chromium instalado por `npx playwright install --with-deps chromium`.
 */

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
