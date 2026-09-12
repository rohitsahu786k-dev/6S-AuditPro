import Audit from "@/models/Audit";
import Department from "@/models/Department";
import Finding from "@/models/Finding";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { addWorkingDays, calculateDepartmentAuditScore, defaultSeverity } from "@/lib/audit-scoring";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";
import { canonicalDepartmentName } from "@/lib/org-utils";

export type AuditListView = "full" | "summary" | "analytics" | "register";

const ADHOC_AUDIT_EMAIL_RECIPIENTS = ["jatin.chouhan@onepws.com", "process@onepws.com"];

const AUDIT_PROJECTIONS: Record<AuditListView, string | null> = {
  full: null,
  summary: "auditNumber auditType title description department zone date startDate endDate totalScore status auditorName findingIds importMetadata checklist.questionId checklist.category checklist.question checklist.response checklist.actionOwnerDepartment",
  analytics: "auditNumber auditType zone department auditorName date startDate endDate status totalScore categoryScores findingIds checklist.questionId checklist.category checklist.question checklist.response checklist.actionOwnerDepartment",
  register: "auditNumber department zone date startDate endDate status checklist.questionId checklist.category checklist.question checklist.response checklist.observation checklist.severity checklist.actionOwnerName checklist.actionOwnerDepartment"
};

export async function nextAuditNumber() {
  const year = new Date().getFullYear();
  const prefix = `6S-${year}-`;
  const last = await Audit.findOne({ auditNumber: new RegExp(`^${prefix}`) }).sort({ createdAt: -1 }).lean();
  const seq = last?.auditNumber ? Number(last.auditNumber.split("-").pop()) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function listAudits(user: SessionUser, view: AuditListView = "full") {
  await connectDB();
  const query: Record<string, unknown> = user.role === "SPOC" && user.department ? { department: user.department } : {};

  // Dashboard analytics is year-specific (Monthly Audit Score - YYYY), so keep
  // Department Summary, Overall Rating, Monthly Audit Score and Recent Audits on
  // the same current-year audit dataset. This prevents historical audits from
  // changing the current dashboard score while the monthly table shows only this year.
  // Adhoc audits stay in this dataset: dashboard and analytics merge them with the
  // department's standard audit of the same month into one score.
  if (view === "analytics") {
    const year = new Date().getFullYear();
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    query.$or = [
      { startDate: { $gte: from, $lt: to } },
      { startDate: { $exists: false }, date: { $gte: from, $lt: to } },
      { startDate: null, date: { $gte: from, $lt: to } }
    ];
  }

  const projection = AUDIT_PROJECTIONS[view] ?? AUDIT_PROJECTIONS.full;
  const request = Audit.find(query).sort({ startDate: -1, date: -1 });
  if (projection) request.select(projection);
  const [audits, departments] = await Promise.all([
    request.lean(),
    Department.find().select("name").lean()
  ]);
  const configuredDepartments = departments.map((department) => department.name).filter(Boolean);
  const auditIds = audits.map((audit) => audit._id);
  const auditNumbers = audits.map((audit) => audit.auditNumber).filter(Boolean);
  const auditDepartments = audits.map((audit) => canonicalDepartmentName(audit.department, configuredDepartments)).filter(Boolean);
  const scoringFindings = view === "register" || audits.length === 0
    ? []
    : await Finding.find({
        $or: [
          { auditId: { $in: auditIds } },
          { auditNumber: { $in: auditNumbers } },
          { department: { $in: auditDepartments } }
        ]
      }).select("_id auditId auditNumber department questionId category question").lean();
  const sourceAuditRefs = view === "register" || scoringFindings.length === 0
    ? []
    : await Audit.find({
        $or: [
          { _id: { $in: scoringFindings.map((finding) => finding.auditId).filter(Boolean) } },
          { auditNumber: { $in: scoringFindings.map((finding) => finding.auditNumber).filter(Boolean) } }
        ]
      }).select("_id auditNumber department").lean();
  const sourceDepartmentByAuditId = new Map(sourceAuditRefs.map((audit) => [
    String(audit._id),
    canonicalDepartmentName(audit.department, configuredDepartments)
  ]));
  const sourceDepartmentByAuditNumber = new Map(sourceAuditRefs.map((audit) => [
    audit.auditNumber,
    canonicalDepartmentName(audit.department, configuredDepartments)
  ]));

  return audits.map((audit) => {
    const department = canonicalDepartmentName(audit.department, configuredDepartments);
    const checklist = Array.isArray(audit.checklist)
      ? audit.checklist.map((item: any) => ({
          ...item,
          ...(item.actionOwnerDepartment
            ? { actionOwnerDepartment: canonicalDepartmentName(item.actionOwnerDepartment, configuredDepartments) }
            : {})
        }))
      : audit.checklist;

    if (view !== "register") {
      const scoring = calculateDepartmentAuditScore({
        audit: { ...audit, department, checklist },
        department,
        findings: scoringFindings,
        configuredDepartments,
        sourceDepartmentByAuditId,
        sourceDepartmentByAuditNumber
      });
      const scoredAudit = {
        ...audit,
        department,
        checklist,
        totalScore: scoring.score,
        categoryScores: scoring.categoryScores,
        adequateCount: scoring.adequateCount,
        ownedNotAdequateCount: scoring.ownedNotAdequateCount,
        applicableCount: scoring.applicableCount,
        naCount: scoring.naCount
      };
      if (view === "summary" || view === "analytics") {
        const listAudit = { ...scoredAudit };
        delete (listAudit as { checklist?: unknown }).checklist;
        return listAudit;
      }
      return scoredAudit;
    }

    return { ...audit, department, checklist };
  });
}

export async function createAudit(input: {
  auditType?: "STANDARD" | "ADHOC";
  title?: string;
  description?: string;
  zone: string;
  department: string;
  auditorName: string;
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  checklist: Array<{
    questionId: string;
    category: string;
    question: string;
    response: "Adequate" | "Not Adequate" | "N/A";
    observation?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
    actionOwnerId?: string;
    actionOwnerUserId?: string;
    actionOwnerName?: string;
    actionOwnerDepartment?: string;
    sourceRowNumber?: number;
    importBatchId?: string;
    dueDate?: Date;
    remarks?: string;
    beforePhotos?: Array<{ secureUrl: string; publicId: string }>;
  }>;
  importMetadata?: {
    originalFileName: string;
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    importBatchId: string;
    fileHash: string;
  };
}, user: SessionUser) {
  await connectDB();
  const auditType = input.auditType || "STANDARD";

  if (auditType === "ADHOC") {
    const departments = await Department.find({ isActive: { $ne: false } }).select("name").lean();
    const configuredDepartments = departments.map((department) => department.name).filter(Boolean);
    const canonicalAuditDepartment = canonicalDepartmentName(input.department, configuredDepartments);
    if (!configuredDepartments.includes(canonicalAuditDepartment)) {
      throw Object.assign(new Error("Invalid audited department for Adhoc Audit."), { status: 400 });
    }
    input.department = canonicalAuditDepartment;

    const users = await User.find({ status: { $ne: "inactive" } }).select("_id name department").lean();
    const usersById = new Map(users.map((portalUser) => [String(portalUser._id), portalUser]));
    input.checklist = input.checklist.map((item, index) => {
      if (!item.question?.trim()) throw Object.assign(new Error(`Row ${index + 1}: Missing Observation.`), { status: 400 });
      if (item.response === "Not Adequate") {
        const ownerDepartment = canonicalDepartmentName(item.actionOwnerDepartment || "", configuredDepartments);
        if (!configuredDepartments.includes(ownerDepartment)) throw Object.assign(new Error(`Row ${index + 1}: Unknown Department.`), { status: 400 });
        if (!item.actionOwnerUserId) throw Object.assign(new Error(`Row ${index + 1}: Unknown Responsible Person.`), { status: 400 });
        const ownerUser = usersById.get(String(item.actionOwnerUserId));
        if (!ownerUser) throw Object.assign(new Error(`Row ${index + 1}: Responsible Person is not an active portal user.`), { status: 400 });
        const userDepartment = canonicalDepartmentName(ownerUser.department || "", configuredDepartments);
        if (userDepartment && userDepartment !== ownerDepartment) {
          throw Object.assign(new Error(`Row ${index + 1}: Responsible Person does not belong to selected department.`), { status: 400 });
        }
        if (!item.dueDate) throw Object.assign(new Error(`Row ${index + 1}: Invalid Target Date.`), { status: 400 });
        return {
          ...item,
          actionOwnerDepartment: ownerDepartment,
          actionOwnerName: item.actionOwnerName || ownerUser.name,
          questionId: item.questionId || `adhoc-${input.importMetadata?.importBatchId || "row"}-${index + 1}`,
          severity: item.severity || defaultSeverity("Not Adequate", item.category)
        };
      }
      return {
        ...item,
        questionId: item.questionId || `adhoc-${input.importMetadata?.importBatchId || "row"}-${index + 1}`
      };
    });
  }

  const initialScoring = calculateDepartmentAuditScore({
    audit: { department: input.department, checklist: input.checklist },
    department: input.department,
    includeTransferredIn: false
  });
  const categoryScores = initialScoring.categoryScores;
  const totalScore = initialScoring.score;
  const startDate = input.startDate || input.date || new Date();
  const audit = await Audit.create({
    auditNumber: await nextAuditNumber(),
    auditType,
    title: input.title,
    description: input.description,
    zone: input.zone,
    department: input.department,
    auditorName: input.auditorName,
    auditor: user.id,
    date: startDate,
    startDate,
    endDate: input.endDate,
    status: "COMPLETED",
    checklist: input.checklist,
    categoryScores,
    totalScore,
    createdBy: user.id
  });
  if (input.importMetadata) {
    audit.importMetadata = {
      ...input.importMetadata,
      importedBy: user.id,
      importedByName: user.name,
      importedAt: new Date()
    } as any;
    await audit.save();
  }

  const findings = await Finding.insertMany(input.checklist
    .filter((item) => item.response === "Not Adequate")
    .map((item, index) => {
      const ownerDepartment = item.actionOwnerDepartment || audit.department;
      const ownerName = item.actionOwnerName || ownerDepartment;
      return {
        findingNumber: `${audit.auditNumber}-F${String(index + 1).padStart(2, "0")}`,
        auditId: audit._id,
        auditNumber: audit.auditNumber,
        auditType,
        zone: audit.zone,
        department: ownerDepartment,
        questionId: item.questionId,
        category: item.category,
        question: item.question,
        severity: item.severity || defaultSeverity(item.response, item.category),
        observation: item.observation,
        beforePhotos: item.beforePhotos || [],
        assignedTo: ownerName,
        assignedUser: item.actionOwnerUserId,
        dueDate: item.dueDate || addWorkingDays(new Date(), 7),
        status: "OPEN",
        createdBy: user.id,
        timeline: [{ action: "Finding created", note: auditType === "ADHOC" ? "Created from Adhoc Excel assessment import" : "Created from audit checklist", by: user.id, byName: user.name }]
      };
    }));

  audit.findingIds = findings.map((finding) => finding._id);
  await audit.save();

  try {
    const recipients = auditType === "ADHOC"
      ? [...ADHOC_AUDIT_EMAIL_RECIPIENTS]
      : await resolveRecipients({ department: audit.department, roles: ["MASTER_ADMIN", "ADMIN", "MANAGEMENT", "AUDITOR"] });
    if (auditType !== "ADHOC" && user.email && !recipients.includes(user.email)) recipients.push(user.email);
    await sendTemplatedEmail({
      triggerEvent: "AUDIT_COMPLETED",
      recipients,
      data: {
        recipientName: "6S AuditPro Team",
        auditNumber: audit.auditNumber,
        departmentName: audit.department,
        zoneName: audit.zone,
        auditorName: audit.auditorName,
        status: audit.status,
        totalScore: `${totalScore}%`
      },
      relatedAuditId: audit._id.toString()
    });
  } catch (err) {
    console.error("Error sending audit completion email:", err);
  }

  await Promise.all(findings.map(async (finding) => {
    try {
      const spocRecipients = auditType === "ADHOC"
        ? [...ADHOC_AUDIT_EMAIL_RECIPIENTS]
        : await resolveRecipients({ department: finding.department, roles: ["SPOC", "ADMIN", "MASTER_ADMIN"] });
      await sendTemplatedEmail({
        triggerEvent: "FINDING_ASSIGNED",
        recipients: spocRecipients,
        data: {
          recipientName: "Department SPOC",
          findingNumber: finding.findingNumber,
          auditNumber: audit.auditNumber,
          departmentName: finding.department,
          zoneName: finding.zone,
          severity: finding.severity,
          dueDate: finding.dueDate ? new Date(finding.dueDate).toLocaleDateString() : "",
          question: finding.question,
          assignedTo: finding.assignedTo || finding.department,
          auditorName: audit.auditorName
        },
        relatedAuditId: audit._id.toString(),
        relatedFindingId: finding._id.toString()
      });
    } catch (err) {
      console.error(`Error sending finding assignment email for ${finding.findingNumber}:`, err);
    }
  }));

  return { audit, findings };
}
