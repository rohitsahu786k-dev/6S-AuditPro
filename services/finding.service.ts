import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";

export type FindingListView = "full" | "summary" | "register" | "media-selector";

const FINDING_PROJECTIONS: Record<FindingListView, string | null> = {
  full: null,
  summary: "findingNumber auditNumber zone department category question severity status dueDate observation createdAt updatedAt",
  register: "auditId questionId status dueDate updatedAt",
  "media-selector": "findingNumber question zone department category status beforePhotos afterPhotos"
};

let lastOverdueRefreshAt = 0;
const OVERDUE_REFRESH_INTERVAL_MS = 60_000;

function scopedQuery(user: SessionUser) {
  return user.role === "SPOC" && user.department ? { department: user.department } : {};
}

async function refreshOverdueStatuses() {
  const now = Date.now();
  if (now - lastOverdueRefreshAt < OVERDUE_REFRESH_INTERVAL_MS) return;
  lastOverdueRefreshAt = now;
  await Finding.updateMany(
    { status: { $in: ["OPEN", "IN_PROGRESS", "SUBMITTED", "REJECTED", "REOPENED"] }, dueDate: { $lt: new Date() } },
    { $set: { status: "OVERDUE" } }
  );
}

export async function listFindings(user: SessionUser, view: FindingListView = "full") {
  await connectDB();
  await refreshOverdueStatuses();
  const projection = FINDING_PROJECTIONS[view] ?? FINDING_PROJECTIONS.full;
  const request = Finding.find(scopedQuery(user)).sort({ createdAt: -1 });
  if (projection) request.select(projection);
  return request.lean();
}

export async function submitCapa(id: string, input: { capaAction: string; closureRemarks?: string; afterPhotos?: Array<{ secureUrl: string; publicId: string }> }, user: SessionUser) {
  await connectDB();
  const finding = await Finding.findOne({ _id: id, ...scopedQuery(user) });
  if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
  finding.capaAction = input.capaAction;
  finding.closureRemarks = input.closureRemarks;
  finding.set("afterPhotos", input.afterPhotos || []);
  finding.capaStatus = "SUBMITTED";
  finding.auditorReviewStatus = "PENDING";
  finding.status = "SUBMITTED";
  finding.timeline.push({ action: "CAPA submitted", note: input.capaAction, by: user.id, byName: user.name, at: new Date() });
  
  const saved = await finding.save();

  // Send CAPA Submitted Email. Awaited so the send completes before the
  // serverless function returns and freezes.
  try {
    const recipients = await resolveRecipients({ roles: ["MASTER_ADMIN", "ADMIN", "AUDITOR"] });
    await sendTemplatedEmail({
      triggerEvent: "CAPA_SUBMITTED",
      recipients,
      data: {
        recipientName: "Auditor / Admin",
        findingNumber: saved.findingNumber,
        auditNumber: saved.auditNumber || "",
        departmentName: saved.department,
        zoneName: saved.zone,
        severity: saved.severity,
        question: saved.question,
        capaAction: saved.capaAction || "",
        closureRemarks: saved.closureRemarks || ""
      },
      relatedFindingId: saved._id.toString()
    });
  } catch (err) {
    console.error("Error sending CAPA submitted email:", err);
  }

  return saved;
}

export async function reviewCapa(id: string, input: { decision: "approve" | "reject" | "reopen"; remarks?: string; rejectionReason?: string }, user: SessionUser) {
  await connectDB();
  const finding = await Finding.findById(id);
  if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
  
  let triggerEvent = "CAPA_APPROVED";
  
  if (input.decision === "approve") {
    finding.status = "CLOSED";
    finding.capaStatus = "APPROVED";
    finding.auditorReviewStatus = "APPROVED";
    triggerEvent = "CAPA_APPROVED";
  } else if (input.decision === "reject") {
    finding.status = "REJECTED";
    finding.capaStatus = "REJECTED";
    finding.auditorReviewStatus = "REJECTED";
    finding.rejectionReason = input.rejectionReason || input.remarks;
    triggerEvent = "CAPA_REJECTED";
  } else {
    finding.status = "REOPENED";
    finding.capaStatus = "NOT_SUBMITTED";
    finding.auditorReviewStatus = "PENDING";
    triggerEvent = "FINDING_REOPENED";
  }
  
  finding.timeline.push({ action: `CAPA ${input.decision}`, note: input.remarks || input.rejectionReason, by: user.id, byName: user.name, at: new Date() });
  const saved = await finding.save();

  // Send review outcome email. Awaited so the send completes before the
  // serverless function returns and freezes.
  const rolesToNotify = input.decision === "approve"
    ? ["SPOC", "ADMIN", "MASTER_ADMIN", "AUDITOR", "MANAGEMENT"]
    : ["SPOC", "ADMIN", "MASTER_ADMIN"];

  try {
    const recipients = await resolveRecipients({ department: saved.department, roles: rolesToNotify as any[] });
    await sendTemplatedEmail({
      triggerEvent,
      recipients,
      data: {
        recipientName: "Team",
        findingNumber: saved.findingNumber,
        status: saved.status,
        closureRemarks: input.remarks || "",
        rejectionReason: saved.rejectionReason || ""
      },
      relatedFindingId: saved._id.toString()
    });
  } catch (err) {
    console.error(`Error sending email for event ${triggerEvent}:`, err);
  }

  return saved;
}
