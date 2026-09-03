import Finding from "@/models/Finding";
import Audit from "@/models/Audit";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import { addWorkingDays, defaultSeverity } from "@/lib/audit-scoring";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";
import { canonicalDepartmentName } from "@/lib/org-utils";

export type FindingListView = "full" | "summary" | "register" | "media-selector";

const FINDING_PROJECTIONS: Record<FindingListView, string | null> = {
  full: null,
  // Timeline dates are included so reporting can use the actual CAPA closure date.
  // updatedAt changes when an owner/department is edited and must not rewrite closure history.
  // Photos are deliberately excluded: legacy rows store images as base64 data URIs,
  // which made this list ~25 MB. The detail view fetches the full finding instead.
  summary: "findingNumber auditNumber zone department category question severity status dueDate observation assignedTo createdAt updatedAt timeline.action timeline.at",
  register: "auditId questionId status dueDate updatedAt",
  // Only identifies findings for the "attach media" picker. The photos themselves are
  // fetched for the one selected finding, so this list stays small.
  "media-selector": "findingNumber question zone department category status assignedTo"
};

type FindingDateRange = {
  fromDate?: Date;
  toDate?: Date;
};

type AuditChecklistItem = {
  questionId?: unknown;
  category?: string;
  question?: string;
  response?: string;
  observation?: string;
  severity?: "Critical" | "High" | "Medium" | "Low";
  actionOwnerName?: string;
  actionOwnerDepartment?: string;
  beforePhotos?: unknown[];
};

let lastOverdueRefreshAt = 0;
let lastFindingReconcileAt = 0;
const OVERDUE_REFRESH_INTERVAL_MS = 60_000;
const FINDING_RECONCILE_INTERVAL_MS = 5 * 60_000;

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

function closureDateOf(finding: any) {
  if (finding.status !== "CLOSED" || !Array.isArray(finding.timeline)) return undefined;
  const closure = [...finding.timeline].reverse().find((entry: any) => {
    const action = String(entry?.action || "").toLowerCase();
    return action.includes("approve") || action.includes("closed");
  });
  return closure?.at;
}

function sameText(left: unknown, right: unknown) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function isSameChecklistFinding(item: AuditChecklistItem, finding: any) {
  if (item.questionId && finding.questionId) {
    return String(item.questionId) === String(finding.questionId);
  }
  return sameText(item.category, finding.category) && sameText(item.question, finding.question);
}

function nextFindingNumber(auditNumber: string, usedNumbers: Set<string>) {
  let sequence = 1;
  while (usedNumbers.has(`${auditNumber}-F${String(sequence).padStart(2, "0")}`)) sequence += 1;
  const findingNumber = `${auditNumber}-F${String(sequence).padStart(2, "0")}`;
  usedNumbers.add(findingNumber);
  return findingNumber;
}

/**
 * Historical/imported audits can contain valid "Not Adequate" checklist rows
 * without a matching Finding document. Reconcile those rows so Audit History,
 * Findings and dashboard reports all use the same source data.
 *
 * This is intentionally throttled and idempotent. It does not send assignment
 * emails for restored historical rows, avoiding duplicate notifications.
 */
async function reconcileMissingAuditFindings() {
  const now = Date.now();
  if (now - lastFindingReconcileAt < FINDING_RECONCILE_INTERVAL_MS) return;
  lastFindingReconcileAt = now;

  // checklist.beforePhotos is excluded here on purpose. Legacy photos are stored as
  // base64 data URIs, so selecting them pulls ~16 MB across every audit. Restoring a
  // finding is rare, so the photos for one audit are fetched only when it is needed.
  const audits = await Audit.find({ status: "COMPLETED" })
    .select([
      "_id auditNumber zone department auditorName date startDate findingIds createdBy",
      "checklist.questionId checklist.category checklist.question checklist.response",
      "checklist.observation checklist.severity checklist.actionOwnerName checklist.actionOwnerDepartment"
    ].join(" "))
    .lean();
  if (audits.length === 0) return;

  const allExisting = await Finding.find({
    $or: [
      { auditId: { $in: audits.map((audit) => audit._id) } },
      { auditNumber: { $in: audits.map((audit) => audit.auditNumber) } }
    ]
  }).select("_id findingNumber auditId auditNumber questionId category question").lean();

  const existingByAudit = new Map<string, any[]>();
  for (const finding of allExisting) {
    for (const key of [String(finding.auditId || ""), String(finding.auditNumber || "")]) {
      if (!key) continue;
      const bucket = existingByAudit.get(key);
      if (bucket) bucket.push(finding);
      else existingByAudit.set(key, [finding]);
    }
  }

  for (const audit of audits) {
    const checklist = (audit.checklist || []) as AuditChecklistItem[];
    const nonConformities = checklist.filter((item) => item.response === "Not Adequate");
    if (nonConformities.length === 0) continue;

    const existing = [
      ...new Map(
        [
          ...(existingByAudit.get(String(audit._id)) || []),
          ...(existingByAudit.get(String(audit.auditNumber)) || [])
        ].map((finding) => [String(finding._id), finding])
      ).values()
    ];

    const missing = nonConformities.filter(
      (item) => !existing.some((finding) => isSameChecklistFinding(item, finding))
    );
    if (missing.length > 0) {
      const withPhotos = await Audit.findById(audit._id).select("checklist.questionId checklist.beforePhotos").lean();
      const photosByQuestion = new Map(
        ((withPhotos?.checklist || []) as AuditChecklistItem[])
          .map((item) => [String(item.questionId), item.beforePhotos || []])
      );
      for (const item of missing) {
        item.beforePhotos = photosByQuestion.get(String(item.questionId)) || [];
      }
    }

    const usedNumbers = new Set(existing.map((finding) => finding.findingNumber).filter(Boolean));
    const linkedIds = new Set(existing.map((finding) => String(finding._id)));
    let restored = 0;

    for (const item of nonConformities) {
      if (existing.some((finding) => isSameChecklistFinding(item, finding))) continue;

      const ownerDepartment = item.actionOwnerDepartment || audit.department;
      const ownerName = item.actionOwnerName || ownerDepartment;
      const auditDate = new Date((audit.startDate || audit.date || new Date()) as Date);

      try {
        const finding = await Finding.create({
          findingNumber: nextFindingNumber(audit.auditNumber, usedNumbers),
          auditId: audit._id,
          auditNumber: audit.auditNumber,
          zone: audit.zone,
          department: ownerDepartment,
          questionId: item.questionId,
          category: item.category || "",
          question: item.question || "Audit finding",
          severity: item.severity || defaultSeverity("Not Adequate", item.category || ""),
          observation: item.observation || "",
          beforePhotos: item.beforePhotos || [],
          assignedTo: ownerName,
          dueDate: addWorkingDays(auditDate, 7),
          status: "OPEN",
          createdBy: audit.createdBy,
          timeline: [{
            action: "Finding restored from audit checklist",
            note: "Restored automatically because the historical audit finding record was missing.",
            by: audit.createdBy,
            byName: audit.auditorName || "System",
            at: auditDate
          }]
        });
        linkedIds.add(String(finding._id));
        existing.push(finding.toObject() as any);
        restored += 1;
      } catch (error: any) {
        // Concurrent requests can race on the unique finding number. Another
        // request may have already restored it, which is safe to ignore.
        if (error?.code !== 11000) {
          console.error(`Unable to restore finding for audit ${audit.auditNumber}:`, error);
        }
      }
    }

    if (restored > 0 || linkedIds.size !== (audit.findingIds || []).length) {
      const allLinked = await Finding.find({
        $or: [{ auditId: audit._id }, { auditNumber: audit.auditNumber }]
      }).select("_id").lean();
      await Audit.updateOne(
        { _id: audit._id },
        { $set: { findingIds: allLinked.map((finding) => finding._id) } }
      );
    }
  }
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
  if (user.role !== "SPOC") await reconcileMissingAuditFindings();
  await refreshOverdueStatuses();
  const projection = FINDING_PROJECTIONS[view] ?? FINDING_PROJECTIONS.full;
  const request = Finding.find(scopedQuery(user, dateRange)).sort({ createdAt: -1 });
  if (projection) request.select(projection);
  const [findings, departments] = await Promise.all([
    request.lean(),
    Department.find().select("name").lean()
  ]);
  const configuredDepartments = departments.map((department) => department.name).filter(Boolean);
  return findings.map((finding) => {
    const closureDate = view === "summary" ? closureDateOf(finding) : undefined;
    return {
      ...finding,
      department: canonicalDepartmentName(finding.department, configuredDepartments),
      // Dashboard uses updatedAt as the closed timestamp. Preserve the true closure
      // timestamp even if action owner/department is edited after closure.
      ...(closureDate ? { updatedAt: closureDate } : {})
    };
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