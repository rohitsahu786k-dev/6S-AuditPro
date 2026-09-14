import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown, fallback = "Something went wrong") {
  if (error instanceof SyntaxError || (error instanceof Error && error.name === "CastError")) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  if ((error as { code?: number })?.code === 11000 || (error instanceof Error && error.name === "VersionError")) {
    return NextResponse.json({ ok: false, error: "The record already exists or was changed. Refresh and try again." }, { status: 409 });
  }
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: "Validation failed", details: error.flatten() }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ ok: false, error: status >= 500 ? fallback : message }, { status });
}

export async function parseJson<T>(request: Request, schema: { parse: (data: unknown) => T }) {
  const body = JSON.parse((await readBody(request, 6 * 1024 * 1024)).toString("utf8"));
  return schema.parse(body);
}

async function readBody(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw Object.assign(new Error("Request body is too large"), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function parseFormData(request: Request) {
  const body = await readBody(request, 6 * 1024 * 1024);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
}
