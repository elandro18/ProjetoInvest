import { expect, test } from "@playwright/test";

test("home carrega com o título do produto", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Investment Control" })).toBeVisible();
  await expect(page).toHaveTitle(/Investment Control/);
});
