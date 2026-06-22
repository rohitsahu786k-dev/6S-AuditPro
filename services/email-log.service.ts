import EmailLog from "@/models/EmailLog";
import { connectDB } from "@/lib/db";

export async function logEmail(input: Record<string, unknown>) {
  await connectDB();
  return EmailLog.create(input);
}

export async function listEmailLogs() {
  await connectDB();
  return EmailLog.find().sort({ createdAt: -1 }).limit(300).lean();
}
