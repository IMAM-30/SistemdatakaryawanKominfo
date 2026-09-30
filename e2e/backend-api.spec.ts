import { expect, test } from "@playwright/test";

test("rejects unauthenticated session access", async ({ request }) => {
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
});

test("rejects malformed backend JSON", async ({ request }) => {
  const response = await request.post("/api/backend", { headers: { "content-type": "application/json" }, data: "not-json" });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
});

test("rejects bootstrap without the owner secret", async ({ request }) => {
  const response = await request.post("/api/setup/bootstrap-master", { data: { username: "master", displayName: "Master", password: "Password!234" } });
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
});
