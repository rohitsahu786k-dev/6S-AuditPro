import { requireUser } from "@/lib/auth";
import { listFindings } from "@/services/finding.service";
import { fail, ok } from "@/utils/api";

export async function GET() {
  try {
    const user = await requireUser("findings:read");
    return ok(await listFindings(user));
  } catch (error) {
    return fail(error);
  }
}
