import { requireUser } from "@/lib/auth";
import { auditSchema } from "@/lib/validators";
import { createAudit, listAudits, type AuditListView } from "@/services/audit.service";
import { fail, ok, parseJson } from "@/utils/api";

const AUDIT_VIEWS = new Set<AuditListView>(["full", "summary", "analytics", "register"]);

export async function GET(request: Request) {
  try {
    const user = await requireUser("audits:read");
    const viewParam = new URL(request.url).searchParams.get("view") || "full";
    const view = AUDIT_VIEWS.has(viewParam as AuditListView) ? viewParam as AuditListView : "full";
    return ok(await listAudits(user, view));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser("audits:create");
    const input = await parseJson(request, auditSchema);
    return ok(await createAudit(input, user), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
