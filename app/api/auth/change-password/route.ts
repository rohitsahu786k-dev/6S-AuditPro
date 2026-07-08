import User from "@/models/User";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { passwordChangeSchema } from "@/lib/validators";
import { sendTemplatedEmail } from "@/services/email.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) return fail(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const input = await parseJson(request, passwordChangeSchema);
    await connectDB();
    const user = await User.findById(session.id).select("+passwordHash");
    if (!user) return fail(Object.assign(new Error("User not found"), { status: 404 }));
    if (input.currentPassword && !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return fail(Object.assign(new Error("Current password is incorrect"), { status: 400 }));
    }
    user.passwordHash = await hashPassword(input.newPassword);
    user.passwordChangedAt = new Date();
    user.forcePasswordChange = false;
    await user.save();

    if (user.email) {
      try {
        await sendTemplatedEmail({
          triggerEvent: "PASSWORD_CHANGED",
          recipients: [user.email],
          data: { recipientName: user.name }
        });
      } catch (err) {
        console.error("Error sending password changed email:", err);
      }
    }

    return ok({ changed: true });
  } catch (error) {
    return fail(error);
  }
}
