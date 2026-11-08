import { expect, test } from "@playwright/test";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("GET /api/health responde 200 com status ok", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok" });
  expect(response.headers()["x-request-id"]).toMatch(UUID_V4);
});
