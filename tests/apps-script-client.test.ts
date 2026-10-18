import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAppsScript } from "@/lib/server/apps-script-client";

vi.mock("@/lib/server/env", () => ({ getServerEnv: () => ({
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/test-deployment/exec",
  APPS_SCRIPT_HMAC_SECRET: "test-signing-secret-not-a-real-credential",
}) }));

describe("Apps Script transport", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("signs each uncached request and returns the response data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, data: { rows: [1] } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callAppsScript("employees.list", { categoryId: "PNS" })).resolves.toEqual({ rows: [1] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://script.google.com/macros/s/test-deployment/exec");
    expect(options).toMatchObject({ method: "POST", cache: "no-store" });
    expect(JSON.parse(options.body)).toMatchObject({ action: "employees.list", payload: { categoryId: "PNS" }, signature: expect.any(String) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps its deadline active after response headers while the body is still arriving", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ok":true,"data":'));
          signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        },
      })));
    }));
    let result: unknown;
    void callAppsScript("employees.list", {}, 100).catch((error) => { result = error; });
    await vi.advanceTimersByTimeAsync(100);
    expect(signal?.aborted).toBe(true);
    expect(result).toMatchObject({ code: "BACKEND_TIMEOUT", status: 504 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts a delayed complete body that arrives before the deadline", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(new ReadableStream({
      start(controller) {
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode('{"ok":true,"data":{"rows":[]}}'));
          controller.close();
        }, 50);
      },
    })))));
    const result = callAppsScript("employees.list", {}, 100);
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toEqual({ rows: [] });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a timeout when headers never arrive without retrying a mutation", async () => {
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    let result: unknown;
    void callAppsScript("employees.save", { name: "Test" }, 100).catch((error) => { result = error; });
    await vi.advanceTimersByTimeAsync(100);
    expect(result).toMatchObject({ code: "BACKEND_TIMEOUT", status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("distinguishes an unavailable connection from a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(callAppsScript("health", {})).rejects.toMatchObject({ code: "BACKEND_UNAVAILABLE", status: 502 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves explicit upstream authentication errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: "SESSION_EXPIRED", message: "Session expired" } })));
    await expect(callAppsScript("auth.sessionGet", {})).rejects.toMatchObject({ code: "SESSION_EXPIRED", message: "Session expired", status: 401 });
  });

  it("returns a gateway error for an upstream HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Service unavailable", { status: 503 })));
    await expect(callAppsScript("health", {})).rejects.toMatchObject({ code: "BACKEND_HTTP", status: 502 });
  });

  it.each(["null", "[]", '{"ok":"true","data":{}}', '{"ok":false,"error":"failed"}', "<html>Google error</html>"])("handles malformed responses without an unhandled TypeError: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(callAppsScript("health", {})).rejects.toMatchObject({ code: "BACKEND_RESPONSE", status: 502 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
