import User from "@/models/User";
import { connectDB } from "@/lib/db";
import type { Role } from "@/types/domain";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function resolveRecipients(options: { department?: string; roles?: Role[]; assignedEmail?: string }) {
  await connectDB();
  const emails = new Set<string>();
  if (options.assignedEmail && EMAIL_RE.test(options.assignedEmail)) emails.add(options.assignedEmail.toLowerCase());

  const roleQuery = options.roles?.length ? { role: { $in: options.roles } } : {};
  const deptQuery = options.department ? { $or: [{ department: options.department }, { department: "All" }, { department: { $exists: false } }] } : {};
  const users = await User.find({ status: "active", email: { $exists: true, $ne: "" }, ...roleQuery, ...deptQuery }).lean();
  for (const user of users) {
    if (user.email && EMAIL_RE.test(user.email)) emails.add(user.email.toLowerCase());
  }
  return [...emails];
}
