import { requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import Audit from "@/models/Audit";
import { connectDB } from "@/lib/db";
import { shareReportSchema } from "@/lib/validators";
import { sendTemplatedEmail } from "@/services/email.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("audits:read");
    const { id } = await context.params;
    const input = await parseJson(request, shareReportSchema);
    // The recipient is caller-supplied and every role holds audits:read, so without
    // a cap this endpoint can address mail from our domain to anyone.
    await consumeRateLimit("audit-share", user.id, 20, 60 * 60_000);
    await consumeRateLimit("audit-share-global", "all", 200, 60 * 60_000);
    await connectDB();

    const audit = await Audit.findOne({
      _id: id,
      ...(user.role === "SPOC" && user.department ? { department: user.department } : {})
    }).lean();
    if (!audit) throw Object.assign(new Error("Audit not found"), { status: 404 });

    const result = await sendTemplatedEmail({
      triggerEvent: "AUDIT_REPORT_SHARED",
      recipients: [input.email],
      data: {
        recipientName: input.email,
        auditNumber: audit.auditNumber,
        departmentName: audit.department,
        zoneName: audit.zone
      },
      relatedAuditId: id
    });

    if (result.status === "failed") throw Object.assign(new Error(result.errorMessage || "Failed to send report"), { status: 502 });
    if (result.status === "skipped") throw Object.assign(new Error("Audit report sharing is not configured (no active email template)"), { status: 400 });

    return ok({ sent: true, sharedBy: user.name });
  } catch (error) {
    return fail(error);
  }
}
