import { requireUser } from "@/lib/auth";
import { auditSchema } from "@/lib/validators";
import { createAudit, listAudits } from "@/services/audit.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function GET() {
  try {
    const user = await requireUser("audits:read");
    return ok(await listAudits(user));
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
