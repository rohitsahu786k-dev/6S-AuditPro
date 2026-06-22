import { requireUser } from "@/lib/auth";
import { fail, ok } from "@/utils/api";

export async function POST() {
  try {
    await requireUser("emailLogs:read");
    return ok({ retried: false, message: "Retry endpoint is reserved until original payload replay is enabled." });
  } catch (error) {
    return fail(error);
  }
}
