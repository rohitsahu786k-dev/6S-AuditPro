import Finding from "@/models/Finding";
import Audit from "@/models/Audit";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";
import { canonicalDepartmentName } from "@/lib/org-utils";
import { canActOnDepartment } from "@/lib/roles";

export type FindingListView = "full" | "summary" | "register" | "media-selector";

const FINDING_PROJECTIONS: Record<FindingListView, string | null> = {
  full: null,
  // Timeline dates are included so reporting can use the actual CAPA closure date.
  // updatedAt changes when an owner/department is edited and must not rewrite closure history.
  // Photos are deliberately excluded: legacy rows store images as base64 data URIs,
  // which made this list ~25 MB. The detail view fetches the full finding instead.
  // The timeline is not read here either; closure dates are looked up separately for
  // the few closed findings that need one.
  summary: "findingNumber auditNumber zone department category question severity status dueDate observation assignedTo createdAt updatedAt",
  // category and question are included so the register can fall back to matching a
  // checklist row by text: legacy findings carry a question id that no longer lines
  // up with the audit checklist, and an id-only match leaves every row reading OPEN.
  register: "auditId auditNumber questionId category question status dueDate updatedAt",
  // Only identifies findings for the "attach media" picker. The photos themselves are
  // fetched for the one selected finding, so this list stays small.
  "media-selector": "findingNumber auditNumber question zone department category status assignedTo createdAt"
};

type FindingDateRange = {
  fromDate?: Date;
  toDate?: Date;
};

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

function timeOf(value: unknown) {
  if (!value) return 0;
  const time = new Date(value as string).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function closureDateOf(finding: any) {
  if (finding.status !== "CLOSED" || !Array.isArray(finding.timeline)) return undefined;
  const closure = [...finding.timeline].reverse().find((entry: any) => {
    const action = String(entry?.action || "").toLowerCase();
    return action.includes("approve") || action.includes("closed");
  });
  return closure?.at;
}



export async function listFindings(user: SessionUser, view: FindingListView = "full", dateRange?: FindingDateRange) {
  await connectDB();
  const projection = FINDING_PROJECTIONS[view] ?? FINDING_PROJECTIONS.full;
  const request = Finding.find(scopedQuery(user, dateRange)).sort({ createdAt: -1 });
  if (projection) request.select(projection);
  // The audit date is not stored on the finding, so it is joined from the parent
  // audit. Only the date columns are read, which keeps this to one small query
  // regardless of how many findings the list returns.
  const [findings, departments] = await Promise.all([
    request.lean(),
    Department.find().select("name").lean()
  ]);
  const audits = await Audit.find({ $or: [
    { _id: { $in: findings.map((finding) => finding.auditId).filter(Boolean) } },
    { auditNumber: { $in: [...new Set(findings.map((finding) => finding.auditNumber).filter(Boolean))] } }
  ] }).select("auditNumber date startDate").lean();
  const configuredDepartments = departments.map((department) => department.name).filter(Boolean);
  const auditDates = new Map<string, Date | undefined>();
  for (const audit of audits) {
    const auditDate = (audit.startDate || audit.date) as Date | undefined;
    if (!auditDate) continue;
    auditDates.set(String(audit._id), auditDate);
    if (audit.auditNumber) auditDates.set(audit.auditNumber, auditDate);
  }

  function auditDateOf(finding: { auditId?: unknown; auditNumber?: string | null }) {
    return auditDates.get(String(finding.auditId || "")) || auditDates.get(finding.auditNumber || "");
  }

  // Closure dates come from the timeline, but only closed findings have one. Reading
  // timelines for just those keeps them out of the much larger list query.
  const closureDates = new Map<string, Date | undefined>();
  if (view === "summary") {
    const closedIds = findings.filter((finding) => finding.status === "CLOSED").map((finding) => finding._id);
    if (closedIds.length > 0) {
      const closed = await Finding.find({ _id: { $in: closedIds } }).select("timeline.action timeline.at").lean();
      for (const finding of closed) closureDates.set(String(finding._id), closureDateOf({ ...finding, status: "CLOSED" }));
    }
  }

  const rows = findings.map((finding) => {
    if (["OPEN", "IN_PROGRESS", "REJECTED", "REOPENED"].includes(finding.status) && finding.dueDate && finding.dueDate.getTime() < Date.now()) {
      finding.status = "OVERDUE";
    }
    const department = canonicalDepartmentName(finding.department, configuredDepartments);
    const auditDate = auditDateOf(finding);
    if (view !== "summary") return { ...finding, department, auditDate };
    // Dashboard uses updatedAt as the closed timestamp. Preserve the true closure
    // timestamp even if action owner/department is edited after closure.
    const closureDate = closureDates.get(String(finding._id));
    return { ...finding, department, auditDate, ...(closureDate ? { updatedAt: closureDate } : {}) };
  });

  // Newest audit first. createdAt alone is the wrong key to order by: a finding
  // reconstructed from an older audit is created long after the audit happened, so
  // ordering by it buries the latest audit under historical rows. The audit date is
  // only known after the join above, so the ordering is applied here rather than in
  // the query. Ad-hoc findings have no audit and fall back to their own date.
  return rows.sort((left, right) => {
    const byDate = timeOf(right.auditDate ?? right.createdAt) - timeOf(left.auditDate ?? left.createdAt);
    if (byDate !== 0) return byDate;
    // Within one audit, keep the newest activity on top and break exact ties on the
    // finding number so the order does not shuffle between requests.
    const byCreated = timeOf(right.createdAt) - timeOf(left.createdAt);
    if (byCreated !== 0) return byCreated;
    return String(right.findingNumber || "").localeCompare(String(left.findingNumber || ""));
  });
}

/**
 * Sends one FINDING_OVERDUE email per finding that just crossed into OVERDUE
 * and hasn't been notified yet (overdueNotifiedAt gates this to a single
 * send per finding, since this runs on a recurring cron schedule).
 */
export async function notifyOverdueFindings() {
  await connectDB();
  await Finding.updateMany(
    { status: { $in: ["OPEN", "IN_PROGRESS", "REJECTED", "REOPENED"] }, dueDate: { $lt: new Date() } },
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
          departmentName: finding.department,
          zoneName: finding.zone,
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
  // Management can see every department's findings but may only close its own, so
  // the ownership check lives here rather than in the list query.
  if (!canActOnDepartment(user, finding.department)) {
    throw Object.assign(new Error("You can only submit a CAPA for your own department."), { status: 403 });
  }
  if (["CLOSED", "SUBMITTED"].includes(finding.status)) {
    throw Object.assign(new Error("This finding cannot accept another CAPA submission"), { status: 409 });
  }
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
  if (input.decision === "reopen" ? finding.status !== "CLOSED" : finding.status !== "SUBMITTED") {
    throw Object.assign(new Error("The finding is no longer in a reviewable state. Refresh and try again."), { status: 409 });
  }
  
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
