import { requireUser } from "@/lib/auth";
import { getMasters } from "@/services/master.service";
import { fail, ok } from "@/utils/api";

export async function GET(request: Request) {
  try {
    const lookupOnly = new URL(request.url).searchParams.get("view") === "lookup";
    await requireUser(lookupOnly ? undefined : "masters:read");
    return ok(await getMasters(lookupOnly));
  } catch (error) {
    return fail(error);
  }
}
