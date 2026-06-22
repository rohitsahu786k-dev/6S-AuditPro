import { requireUser } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validators";
import { createUser, listUsers } from "@/services/user.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function GET() {
  try {
    await requireUser("users:read");
    return ok(await listUsers());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser("users:create");
    const input = await parseJson(request, userCreateSchema);
    const user = await createUser(input);
    return ok(user, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
