import { requireUser } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validators";
import { updateUser } from "@/services/user.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("users:update");
    const { id } = await context.params;
    const input = await parseJson(request, userUpdateSchema);
    return ok(await updateUser(id, input));
  } catch (error) {
    return fail(error);
  }
}
