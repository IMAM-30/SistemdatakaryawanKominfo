import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BackendError } from "@/lib/server/apps-script-client";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new BackendError("INVALID_JSON", "Body permintaan harus berupa objek JSON yang valid.", 400); }
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message: "Data permintaan tidak valid.", details: z.flattenError(error).fieldErrors } }, { status: 400 });
  if (error instanceof BackendError) return NextResponse.json({ ok: false, error: { code: error.code, message: error.message, details: error.details ?? null } }, { status: error.status });
  console.error("Unhandled API error", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Terjadi kesalahan internal." } }, { status: 500 });
}

export function ok<T>(data: T, status = 200) { return NextResponse.json({ ok: true, data }, { status }); }
