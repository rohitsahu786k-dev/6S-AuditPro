import { requireUser } from "@/lib/auth";
import { getMasters } from "@/services/master.service";
import { fail, ok } from "@/utils/api";

export async function GET() {
  try {
    await requireUser("masters:read");
    return ok(await getMasters());
  } catch (error) {
    return fail(error);
  }
}
