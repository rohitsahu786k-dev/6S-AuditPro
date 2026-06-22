import { requireUser } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/roles";
import { fail, ok } from "@/utils/api";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ role: user.role, permissions: ROLE_PERMISSIONS[user.role] });
  } catch (error) {
    return fail(error);
  }
}
