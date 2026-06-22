import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, ROLE_PERMISSIONS, ROLE_ROUTES } from "@/lib/roles";
import { fail, ok } from "@/utils/api";

export async function GET() {
  try {
    await requireUser();
    return ok({ labels: ROLE_LABELS, permissions: ROLE_PERMISSIONS, routes: ROLE_ROUTES });
  } catch (error) {
    return fail(error);
  }
}
