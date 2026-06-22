import { requireUser } from "@/lib/auth";
import { deactivateUser } from "@/services/user.service";
import { fail, ok } from "@/utils/api";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("users:disable");
    const { id } = await context.params;
    return ok(await deactivateUser(id));
  } catch (error) {
    return fail(error);
  }
}
