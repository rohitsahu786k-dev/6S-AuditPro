import { assertCronAuthorized } from "@/lib/cron-auth";
import { sendActivitySummary } from "@/services/summary.service";
import { fail, ok } from "@/utils/api";

export async function POST(request: Request) {
  try {
    assertCronAuthorized(request);
    return ok(await sendActivitySummary());
  } catch (error) {
    return fail(error);
  }
}
