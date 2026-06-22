import { requireUser } from "@/lib/auth";
import { listEmailLogs } from "@/services/email-log.service";
import { fail, ok } from "@/utils/api";

export async function GET() {
  try {
    await requireUser("emailLogs:read");
    return ok(await listEmailLogs());
  } catch (error) {
    return fail(error);
  }
}
