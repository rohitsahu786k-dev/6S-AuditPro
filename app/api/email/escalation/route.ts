import { requireUser } from "@/lib/auth";
import { notifyOverdueFindings } from "@/services/finding.service";
import { fail, ok } from "@/utils/api";

export async function POST() {
  try {
    await requireUser("emailTemplates:update");
    return ok(await notifyOverdueFindings());
  } catch (error) {
    return fail(error);
  }
}
