import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import EmailLog from "@/models/EmailLog";
import { retryEmailSchema } from "@/lib/validators";
import { sendTemplatedEmail } from "@/services/email.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request) {
  try {
    await requireUser("emailLogs:read");
    const input = await parseJson(request, retryEmailSchema);
    await connectDB();

    const log = await EmailLog.findById(input.logId).lean();
    if (!log) throw Object.assign(new Error("Email log not found"), { status: 404 });
    if (log.status !== "failed") throw Object.assign(new Error("Only failed sends can be retried"), { status: 400 });
    if (!log.payload) throw Object.assign(new Error("Original send payload was not captured; cannot retry"), { status: 400 });

    const result = await sendTemplatedEmail(log.payload as any);
    return ok({ retried: true, status: result.status });
  } catch (error) {
    return fail(error);
  }
}
