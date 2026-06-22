import { requireUser } from "@/lib/auth";
import { passwordChangeSchema } from "@/lib/validators";
import { updateUser } from "@/services/user.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("users:update");
    const { id } = await context.params;
    const input = await parseJson(request, passwordChangeSchema);
    return ok(await updateUser(id, { password: input.newPassword }));
  } catch (error) {
    return fail(error);
  }
}
