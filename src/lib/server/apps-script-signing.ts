import { createHash, createHmac, randomUUID } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export interface SigningInput {
  action: string;
  payload: unknown;
  secret: string;
  requestId?: string;
  nonce?: string;
  timestamp?: number;
}

export function buildSignedEnvelope(input: SigningInput) {
  const requestId = input.requestId ?? randomUUID();
  const nonce = input.nonce ?? randomUUID();
  const timestamp = input.timestamp ?? Date.now();
  const payloadHash = createHash("sha256").update(stableStringify(input.payload)).digest("base64url");
  const canonical = [timestamp, nonce, requestId, input.action, payloadHash].join("|");
  const signature = createHmac("sha256", input.secret).update(canonical).digest("base64url");
  return { action: input.action, payload: input.payload, requestId, nonce, timestamp, payloadHash, signature };
}
