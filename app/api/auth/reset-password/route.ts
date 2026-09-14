import crypto from "crypto";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validators";
import { consumeRateLimit } from "@/lib/rate-limit";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, resetPasswordSchema);
    // Unauthenticated and hits the database on every call. The token itself is
    // 256-bit, so this caps the request volume rather than the guess space.
    await consumeRateLimit("password-reset-submit", "all", 200, 60 * 60_000);
    await connectDB();

    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    }).select("+passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      throw Object.assign(new Error("This reset link is invalid or has expired"), { status: 400 });
    }

    const result = await User.updateOne({
      _id: user._id, status: "active", passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    }, {
      $set: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date(), forcePasswordChange: false },
      $unset: { passwordResetTokenHash: "", passwordResetExpires: "" }
    });
    if (!result.modifiedCount) {
      throw Object.assign(new Error("This reset link is invalid or has expired"), { status: 400 });
    }

    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
