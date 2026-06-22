import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown, fallback = "Something went wrong") {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: "Validation failed", details: error.flatten() }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ ok: false, error: status >= 500 ? fallback : message }, { status });
}

export async function parseJson<T>(request: Request, schema: { parse: (data: unknown) => T }) {
  const body = await request.json();
  return schema.parse(body);
}
