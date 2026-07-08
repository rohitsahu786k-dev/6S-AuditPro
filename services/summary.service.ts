import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";

export async function sendActivitySummary() {
  await connectDB();
  const findings = await Finding.find().select("status severity").lean();

  const openCount = findings.filter((f) => f.status === "OPEN" || f.status === "REOPENED").length;
  const inProgressCount = findings.filter((f) => f.status === "IN_PROGRESS").length;
  const closedCount = findings.filter((f) => f.status === "CLOSED").length;
  const overdueCount = findings.filter((f) => f.status === "OVERDUE").length;
  const criticalCount = findings.filter((f) => f.status !== "CLOSED" && f.severity === "Critical").length;

  const recipients = await resolveRecipients({ roles: ["MASTER_ADMIN", "ADMIN", "MANAGEMENT"] });
  return sendTemplatedEmail({
    triggerEvent: "SUMMARY",
    recipients,
    data: {
      recipientName: "Team",
      openCount,
      inProgressCount,
      closedCount,
      overdueCount,
      criticalCount
    }
  });
}
