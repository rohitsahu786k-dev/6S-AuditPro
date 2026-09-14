import assert from "node:assert/strict";
import sanitize from "sanitize-html";
import { sanitizeHtml, renderTemplate } from "../lib/email-template-renderer";
import { getAppUrl } from "../lib/app-url";
import { positiveInteger, adhocEmailRecipients } from "../lib/runtime-config";
import { loginSchema, resetPasswordSchema, signupSchema, auditSchema, photoSchema, capaSchema } from "../lib/validators";
import { parseJson, parseFormData, fail } from "../utils/api";
import { canActOnDepartment, permissionsForRole, ROLES, ROLE_PERMISSIONS, ROLE_ROUTES } from "../lib/roles";
import { ALL_PERMISSIONS, ALL_ROUTES, ALWAYS_ALLOWED_ROUTES, LOCKED_ROLE, PERMISSION_GROUPS, ROUTE_CATALOG } from "../lib/permission-catalog";
import { roleConfigSchema } from "../lib/validators";
import type { Permission } from "../types/domain";
import { z } from "zod";

/** Every attribute name the parser finds on the rendered markup, tags and all. */
function attributeNames(html: string) {
  const names: string[] = [];
  sanitize(html, {
    // Allow-all: this call parses, it does not sanitize, so the vulnerable-tag
    // warning does not apply and would otherwise drown the test output.
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: { "*": (tagName, attribs) => { names.push(...Object.keys(attribs)); return { tagName, attribs }; } }
  });
  return names;
}

async function main() {
  const clean = sanitizeHtml("<img src='https://example.com/a.png' onerror='alert(1)'><a href='javascript:alert(1)'>bad</a><svg onload=alert(1)></svg><script>alert(1)</script>");
  assert(!/onerror|onload|javascript:|<script|<svg/i.test(clean));
  assert(clean.includes("https://example.com/a.png"));
  // A substituted value must never become markup. Checking the rendered string for
  // "onmouseover=" is not that test: the sanitizer leaves the payload as inert text
  // inside the element, which matches the substring while executing nothing. Parse
  // the result instead and assert on the attributes that actually survived.
  for (const template of ["<a title='{{name}}'>{{name}}</a>", "<a class='{{name}}'>{{name}}</a>", '<img src="{{name}}">']) {
    for (const payload of ["' onmouseover='alert(1)", '" onerror="alert(1)', "</a><script>alert(1)</script>", "javascript:alert(1)"]) {
      const { rendered } = renderTemplate(template, { name: payload });
      assert(!/<script/i.test(rendered), `${template} + ${payload} produced a script tag`);
      assert(!attributeNames(rendered).some((attribute) => /^on/i.test(attribute)), `${template} + ${payload} produced an event handler attribute`);
      assert(!/(href|src)="javascript:/i.test(rendered), `${template} + ${payload} produced a javascript: URL`);
    }
  }
  assert.equal(renderTemplate("{{name}}", { name: "A & B" }, "text").rendered, "A & B");
  assert.deepEqual(renderTemplate("{{missing}}", {}).missingVariables, ["missing"]);
  assert(!loginSchema.safeParse({ username: { $ne: "" }, password: "12345678" }).success);
  assert(!resetPasswordSchema.safeParse({ token: "a".repeat(10), newPassword: "password123" }).success);
  assert(!signupSchema.safeParse({ name: "Tester", username: "tester", email: "test@example.com", password: "x".repeat(73) }).success);
  assert(!auditSchema.safeParse({ auditType: "STANDARD", department: "A", zone: "A", auditorName: "Test", date: new Date(), checklist: Array.from({ length: 1001 }, () => ({ questionId: "a", category: "A", question: "A", response: "Adequate" })) }).success);
  // Photo URLs are re-submitted by the client and rendered into mail and PDFs, so
  // only https URLs on an approved media host may be stored.
  for (const url of ["http://res.cloudinary.com/a.png", "https://evil.example/a.png", "https://res.cloudinary.com.evil.example/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA"]) {
    assert(!photoSchema.safeParse({ secureUrl: url, publicId: "x" }).success, `${url} must be rejected`);
  }
  assert(photoSchema.safeParse({ secureUrl: "https://res.cloudinary.com/demo/image/upload/a.png", publicId: "x" }).success);
  // Free-text fields are bounded so one request cannot store megabytes per document.
  assert(!capaSchema.safeParse({ capaAction: "x".repeat(4001), afterPhotos: [] }).success);
  // The Findings screen and the CAPA endpoint must agree on who may close a finding.
  // They used to decide separately and disagreed, which hid the after-photo upload
  // from the department HOD.
  assert(permissionsForRole("MANAGEMENT").includes("capa:submit"), "HOD must be able to submit a CAPA");
  assert(permissionsForRole("SPOC").includes("capa:submit"));
  assert(!permissionsForRole("AUDITOR").includes("capa:submit"), "Auditors review, they do not submit");
  assert(!permissionsForRole("MANAGEMENT").includes("findings:update"), "Management stays out of finding metadata");

  // The SPOC is the department boundary; every other role acts organisation-wide.
  assert(canActOnDepartment({ role: "SPOC", department: "Stores" }, "Stores"));
  assert(canActOnDepartment({ role: "SPOC", department: " stores " }, "Stores"), "Spelling drift must not lock a SPOC out");
  assert(!canActOnDepartment({ role: "SPOC", department: "Stores" }, "Production"), "A SPOC must not close another department");
  assert(!canActOnDepartment({ role: "SPOC", department: "" }, "Stores"), "No department means no write scope");
  // Management oversees every department and most of these accounts carry no
  // department, so it must not be scoped by one.
  for (const department of ["HR & Admin", undefined]) {
    assert(canActOnDepartment({ role: "MANAGEMENT", department }, "HSE"), "A HOD closes findings in any department");
  }
  for (const role of ["MASTER_ADMIN", "ADMIN", "AUDITOR"] as const) {
    assert(canActOnDepartment({ role, department: undefined }, "Production"), role + " acts organisation-wide");
  }

  // The Permissions screen renders from the catalogue, so a permission missing from
  // it is a permission no administrator can ever grant or revoke.
  const catalogued = new Set(ALL_PERMISSIONS);
  assert.equal(catalogued.size, ALL_PERMISSIONS.length, "The catalogue must not list a permission twice");
  for (const role of ROLES) {
    for (const granted of ROLE_PERMISSIONS[role]) {
      assert(catalogued.has(granted), `${granted} is granted to ${role} but missing from the catalogue`);
    }
    for (const route of ROLE_ROUTES[role]) {
      assert(ALL_ROUTES.includes(route) || ALWAYS_ALLOWED_ROUTES.includes(route), `${route} is granted to ${role} but missing from the route catalogue`);
    }
  }
  assert.equal(new Set(PERMISSION_GROUPS.map((g) => g.key)).size, PERMISSION_GROUPS.length, "Duplicate permission group key");
  assert.equal(new Set(ROUTE_CATALOG.map((r) => r.id)).size, ROUTE_CATALOG.length, "Duplicate route in the catalogue");
  assert(!ALL_ROUTES.some((r) => ALWAYS_ALLOWED_ROUTES.includes(r)), "An always-allowed page must not also be grantable");

  // Master Admin is the recovery role: it must hold everything, so a mis-saved
  // configuration can never leave the portal with nobody able to undo it.
  assert.equal(LOCKED_ROLE, "MASTER_ADMIN");
  for (const permission of ALL_PERMISSIONS) {
    assert(ROLE_PERMISSIONS.MASTER_ADMIN.includes(permission), `Master Admin must hold ${permission}`);
  }
  assert(ROLE_PERMISSIONS.MASTER_ADMIN.includes("settings:manage"), "Only Master Admin reaches the Permissions screen by default");
  for (const role of ROLES.filter((r) => r !== LOCKED_ROLE)) {
    assert(!ROLE_PERMISSIONS[role].includes("settings:manage"), `${role} must not manage settings by default`);
  }

  // The saved payload is bounded and unknown ids are dropped, not trusted.
  assert(!roleConfigSchema.safeParse({ role: "NOT_A_ROLE", permissions: [], routes: [] }).success);
  assert(!roleConfigSchema.safeParse({ role: "ADMIN", permissions: Array.from({ length: 201 }, () => "x"), routes: [] }).success);
  assert(roleConfigSchema.safeParse({ role: "ADMIN", permissions: ["audits:read"], routes: ["/findings"] }).success);
  {
    const parsed = roleConfigSchema.parse({ role: "SPOC", permissions: ["audits:read", "made:up"], routes: ["/findings", "/nope"] });
    const permissions = parsed.permissions.filter((x): x is Permission => ALL_PERMISSIONS.includes(x as Permission));
    const routes = parsed.routes.filter((x) => ALL_ROUTES.includes(x));
    assert.deepEqual(permissions, ["audits:read"], "Unknown permissions must be discarded");
    assert.deepEqual(routes, ["/findings"], "Unknown routes must be discarded");
  }
  void permissionsForRole;

  const original = { ...process.env };
  try {
    process.env.APP_BASE_URL = "https://example.com/subpath";
    assert.equal(getAppUrl(), "https://example.com");
    process.env.APP_BASE_URL = "javascript:alert(1)";
    assert.throws(getAppUrl);
    process.env.QC_INTEGER = "-1";
    assert.throws(() => positiveInteger("QC_INTEGER", 5));
    process.env.ADHOC_AUDIT_EMAIL_RECIPIENTS = "a@example.com,a@example.com,b@example.com";
    assert.deepEqual(adhocEmailRecipients(), ["a@example.com", "b@example.com"]);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
  const valid = new Request("http://localhost/api/test", { method: "POST", body: '{"value":1}' });
  assert.deepEqual(await parseJson(valid, z.object({ value: z.number() })), { value: 1 });
  await assert.rejects(() => parseJson(new Request("http://localhost", { method: "POST", body: "{" }), z.any()), SyntaxError);
  await assert.rejects(() => parseJson(new Request("http://localhost", { method: "POST", body: "x".repeat(6 * 1024 * 1024 + 1) }), z.any()), (error: unknown) => (error as { status: number }).status === 413);
  const form = new FormData();
  form.set("file", new File(["abc"], "test.txt"));
  const parsed = await parseFormData(new Request("http://localhost", { method: "POST", body: form }));
  assert.equal(await (parsed.get("file") as File).text(), "abc");
  assert.equal(fail(new SyntaxError()).status, 400);
  assert.equal(fail(Object.assign(new Error(), { code: 11000 })).status, 409);
  assert.equal((await fail(new Error("secret database URI")).json()).error, "Something went wrong");
  console.log("Security and request-boundary checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
