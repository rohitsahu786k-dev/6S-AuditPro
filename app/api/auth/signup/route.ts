import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { createUser } from "@/services/user.service";
import { signupSchema } from "@/lib/validators";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, signupSchema);
    await connectDB();

    const existing = await User.findOne({
      $or: [{ username: input.username.toLowerCase() }, { email: input.email.toLowerCase() }]
    });
    if (existing) {
      throw Object.assign(new Error("Username or email is already registered"), { status: 409 });
    }

    const user = await createUser({
      name: input.name,
      username: input.username,
      email: input.email,
      password: input.password,
      role: "AUDITOR"
    });

    return ok({ id: user._id.toString(), username: user.username }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
