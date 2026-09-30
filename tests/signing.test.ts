import { describe, expect, it } from "vitest";
import { buildSignedEnvelope, stableStringify } from "@/lib/server/apps-script-signing";

describe("Apps Script request signing", () => {
  it("canonicalizes object keys recursively", () => {
    expect(stableStringify({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  });

  it("creates a deterministic signature for fixed request metadata", () => {
    const first = buildSignedEnvelope({ action: "health", payload: { b: 2, a: 1 }, secret: "secret", requestId: "req-1", nonce: "nonce-1", timestamp: 1_700_000_000_000 });
    const second = buildSignedEnvelope({ action: "health", payload: { a: 1, b: 2 }, secret: "secret", requestId: "req-1", nonce: "nonce-1", timestamp: 1_700_000_000_000 });
    expect(first.signature).toBe(second.signature);
    expect(first.payloadHash).toBe(second.payloadHash);
  });
});
