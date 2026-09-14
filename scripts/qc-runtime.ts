import "dotenv/config";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { encode } from "next-auth/jwt";
import { mkdir, writeFile } from "node:fs/promises";

async function main() {
  const origin = process.env.QC_BASE_URL || "http://127.0.0.1:3001";
  assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "QC sessions are restricted to a local server");
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  // Auth.js prefixes the session cookie with __Secure- whenever the configured
  // AUTH_URL is https, which is what a production-shaped .env gives a local run.
  // Signing the token under the wrong salt 401s every authenticated probe and
  // reads as a broken app, so the cookie name is derived rather than assumed.
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || origin;
  const sessionCookie = `${new URL(authUrl).protocol === "https:" ? "__Secure-" : ""}authjs.session-token`;
  assert(secret && process.env.MONGODB_URI, "Database and auth configuration required");
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 2, autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db!;
  const started = Date.now();
  await db.command({ ping: 1 }, { timeoutMS: 5000 });
  console.log(`Database ping: ${Date.now() - started}ms`);
  const hello = await db.command({ hello: 1 });
  assert(hello.setName || hello.msg === "isdbgrid", "Transactions require a replica set or sharded cluster");
  const users = await db.collection("users").find({ status: "active" }, { projection: { name: 1, username: 1, role: 1, department: 1, zone: 1 } }).toArray();
  const admin = users.find((user) => user.role === "MASTER_ADMIN");
  assert(admin, "An active Master Admin is required for read-only runtime QC");
  async function tokenFor(user: typeof admin, signedInAt = Date.now()) {
    return encode({ secret: secret!, salt: sessionCookie, maxAge: 3600, token: {
      id: String(user!._id), name: user!.name, username: user!.username, role: user!.role,
      department: user!.department, zone: user!.zone, signedInAt
    } });
  }
  async function check(path: string, expected: number, token?: string, init?: RequestInit) {
    const start = Date.now();
    const response = await fetch(`${origin}${path}`, { ...init, redirect: "manual", headers: { ...(token ? { Cookie: `${sessionCookie}=${token}` } : {}), ...init?.headers } });
    const body = await response.text();
    assert.equal(response.status, expected, `${path}: ${body.slice(0, 160)}`);
    console.log(`${expected} ${path}: ${Date.now() - start}ms, ${Buffer.byteLength(body)} bytes`);
    return { response, body };
  }
  const token = await tokenFor(admin);
  for (const path of ["/api/audits", "/api/findings", "/api/media", "/api/users", "/api/masters"]) await check(path, 401);
  await check("/api/auth/signup", 403, undefined, { method: "POST", body: "{}" });
  await check("/api/users", 401, await tokenFor(admin, 1));
  await check("/api/users", 401, await tokenFor({ ...admin, _id: new mongoose.Types.ObjectId() }));
  await check("/api/findings", 403, token, { method: "POST", headers: { Origin: "https://untrusted.example" }, body: "{}" });
  for (const path of ["/api/auth/me", "/api/audits?view=summary", "/api/audits?view=analytics", "/api/findings?view=summary", "/api/findings?view=register", "/api/masters?view=lookup", "/api/users", "/api/email/logs", "/api/email/templates", "/api/media", "/api/audits/adhoc/template"]) {
    const result = await check(path, 200, token);
    assert(!result.body.includes('"passwordHash"'), "Password hashes must never be returned");
    if (path === "/api/email/logs") assert(!result.body.includes('"payload"'), "Email payloads must stay private");
  }
  await check("/api/findings/not-an-id", 400, token);
  await check("/api/auth/change-password", 400, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: "qc-never-saved-password" }) });
  for (const role of ["ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"]) {
    const user = users.find((entry) => entry.role === role && (role !== "SPOC" || entry.department));
    if (!user) { console.log(`SKIP ${role}: no configured account`); continue; }
    const roleToken = await tokenFor(user);
    await check("/api/users", role === "ADMIN" ? 200 : 403, roleToken);
    if (role === "ADMIN") await check(`/api/users/${admin._id}`, 403, roleToken, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "must-not-save" }) });
    if (role === "SPOC") {
      const { body } = await check("/api/findings?view=summary", 200, roleToken);
      const findings = JSON.parse(body).data;
      assert(findings.every((finding: { department: string }) => finding.department === user.department));
    }
  }
  await mkdir("output/playwright", { recursive: true });
  await writeFile("output/playwright/qc-state.json", JSON.stringify({ cookies: [{ name: sessionCookie, value: token, domain: new URL(origin).hostname, path: "/", expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, secure: sessionCookie.startsWith("__Secure-"), sameSite: "Lax" }], origins: [] }), { mode: 0o600 });
  console.log("Read-only runtime QC passed; temporary browser state stored in ignored output directory.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "QC failed"); process.exitCode = 1; }).finally(() => mongoose.disconnect());
