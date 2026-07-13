import { assertCronAuthorized } from "@/lib/cron-auth";
import { notifyOverdueFindings } from "@/services/finding.service";
import { fail, ok } from "@/utils/api";

async function run(request: Request) {
  try {
    assertCronAuthorized(request);
    return ok(await notifyOverdueFindings());
  } catch (error) {
    return fail(error);
  }
}

export const GET = run;
export const POST = run;
