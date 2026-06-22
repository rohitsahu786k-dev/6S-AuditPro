import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/utils/api";

export async function GET() {
  try {
    await requireUser("reports:export");
    return ok({ message: "Report exports are available from client-side CSV/PDF modules and will be expanded with server rendering." });
  } catch (error) {
    return fail(error);
  }
}
