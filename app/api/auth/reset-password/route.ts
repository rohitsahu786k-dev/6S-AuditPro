import crypto from "crypto";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validators";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, resetPasswordSchema);
    await connectDB();

    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    }).select("+passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      throw Object.assign(new Error("This reset link is invalid or has expired"), { status: 400 });
    }

    user.passwordHash = await hashPassword(input.newPassword);
    user.passwordChangedAt = new Date();
    user.forcePasswordChange = false;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
