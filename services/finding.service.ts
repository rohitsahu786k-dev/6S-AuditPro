import Finding from "@/models/Finding";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";
import { canonicalDepartmentName } from "@/lib/org-utils";

export type FindingListView = "full" | "summary" | "register" | "media-selector";

const FINDING_PROJECTIONS: Record<FindingListView, string | null> = {
  full: null,
  summary: "findingNumber auditNumber zone department category question severity status dueDate observation beforePhotos assignedTo createdAt updatedAt",
  register: "auditId questionId status dueDate updatedAt",
  "media-selector": "findingNumber question zone department category status assignedTo beforePhotos afterPhotos"
};

type FindingDateRange = {
  fromDate?: Date;
  toDate?: Date;
};

let lastOverdueRefreshAt = 0;
const OVERDUE_REFRESH_INTERVAL_MS = 60_000;

function scopedQuery(user: SessionUser, dateRange?: FindingDateRange) {
  const query: Record<string, unknown> = {};
  if (user.role === "SPOC" && user.department) query.department = user.department;

  if (dateRange?.fromDate || dateRange?.toDate) {
    const createdAt: Record<string, Date> = {};
    if (dateRange.fromDate) createdAt.$gte = dateRange.fromDate;
    if (dateRange.toDate) createdAt.$lte = dateRange.toDate;
    query.createdAt = createdAt;
  }

  return query;
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

export async function listFindings(user: SessionUser, view: FindingListView = "full", dateRange?: FindingDateRange) {
  await connectDB();
  await refreshOverdueStatuses();
  const projection = FINDING_PROJECTIONS[view] ?? FINDING_PROJECTIONS.full;
  const request = Finding.find(scopedQuery(user, dateRange)).sort({ createdAt: -1 });
  if (projection) request.select(projection);
  const [findings, departments] = await Promise.all([
    request.lean(),
    Department.find().select("name").lean()
  ]);
  const configuredDepartments = departments.map((department) => department.name).filter(Boolean);
  return findings.map((finding) => ({
    ...finding,
    department: canonicalDepartmentName(finding.department, configuredDepartments)
  }));
}

/**
 * Sends one FINDING_OVERDUE email per finding that just crossed into OVERDUE
 * and hasn't been notified yet (overdueNotifiedAt gates this to a single
 * send per finding, since this runs on a recurring cron schedule).
 */
export async function notifyOverdueFindings() {
  await connectDB();
  await Finding.updateMany(
    { status: { $in: ["OPEN", "IN_PROGRESS", "SUBMITTED", "REJECTED", "REOPENED"] }, dueDate: { $lt: new Date() } },
    { $set: { status: "OVERDUE" } }
  );

  const overdue = await Finding.find({ status: "OVERDUE", overdueNotifiedAt: { $exists: false } });
  let notified = 0;

  for (const finding of overdue) {
    try {
      const recipients = await resolveRecipients({ department: finding.department, roles: ["MANAGEMENT", "SPOC", "ADMIN", "MASTER_ADMIN"] });
      await sendTemplatedEmail({
        triggerEvent: "FINDING_OVERDUE",
        recipients,
        data: {
          recipientName: "Manager / HOD",
          findingNumber: finding.findingNumber,
          auditNumber: finding.auditNumber || "",
          zoneName: finding.zone,
          departmentName: finding.department,
          severity: finding.severity,
          dueDate: finding.dueDate ? new Date(finding.dueDate).toLocaleDateString() : ""
        },
        relatedFindingId: finding._id.toString()
      });
      finding.overdueNotifiedAt = new Date();
      await finding.save();
      notified += 1;
    } catch (err) {
      console.error(`Error sending overdue reminder for ${finding.findingNumber}:`, err);
    }
  }

  return { checked: overdue.length, notified };
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
