import crypto from "crypto";
import User from "@/models/User";
import { getAppLink } from "@/lib/app-url";
import { connectDB } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendTemplatedEmail } from "@/services/email.service";
import { fail, ok, parseJson } from "@/utils/api";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, forgotPasswordSchema);
    await connectDB();

    const user = await User.findOne({ email: input.email.toLowerCase(), status: "active" });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();

      const resetUrl = getAppLink(`/reset-password?token=${rawToken}`);

      await sendTemplatedEmail({
        triggerEvent: "PASSWORD_RESET_REQUESTED",
        recipients: [user.email as string],
        data: { recipientName: user.name, resetUrl }
      });
    }

    // Always return a generic success response so existing accounts can't be enumerated by email.
    return ok({ sent: true });
  } catch (error) {
    return fail(error);
  }
}
