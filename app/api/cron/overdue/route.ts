import { assertCronAuthorized } from "@/lib/cron-auth";
import { notifyOverdueFindings } from "@/services/finding.service";
import { fail, ok } from "@/utils/api";

export async function POST(request: Request) {
  try {
    assertCronAuthorized(request);
    return ok(await notifyOverdueFindings());
  } catch (error) {
    return fail(error);
  }
}
