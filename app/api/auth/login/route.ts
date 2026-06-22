import { authenticate, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, loginSchema);
    const user = await authenticate(input.username, input.password);
    if (!user) return fail(Object.assign(new Error("Invalid username or password"), { status: 401 }));
    await setSessionCookie({
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      email: user.email || undefined,
      role: user.role,
      department: user.department || undefined,
      zone: user.zone || undefined
    });
    return ok({ id: user._id.toString(), name: user.name, username: user.username, role: user.role, department: user.department || undefined });
  } catch (error) {
    return fail(error);
  }
}
