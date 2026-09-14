import EmailLog from "@/models/EmailLog";
import { connectDB } from "@/lib/db";
import { positiveInteger } from "@/lib/runtime-config";

export async function logEmail(input: Record<string, unknown>) {
  await connectDB();
  return EmailLog.create(input);
}

export async function listEmailLogs() {
  await connectDB();
  return EmailLog.find().select("-payload").sort({ createdAt: -1 }).limit(positiveInteger("EMAIL_LOG_PAGE_SIZE", 300, 5000)).lean();
}
