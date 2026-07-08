import { requireUser } from "@/lib/auth";
import { passwordChangeSchema } from "@/lib/validators";
import { updateUser } from "@/services/user.service";
import { sendTemplatedEmail } from "@/services/email.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("users:update");
    const { id } = await context.params;
    const input = await parseJson(request, passwordChangeSchema);
    const updated = await updateUser(id, { password: input.newPassword });

    if (updated?.email) {
      try {
        await sendTemplatedEmail({
          triggerEvent: "PASSWORD_CHANGED",
          recipients: [updated.email],
          data: { recipientName: updated.name }
        });
      } catch (err) {
        console.error("Error sending password changed email:", err);
      }
    }

    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}
