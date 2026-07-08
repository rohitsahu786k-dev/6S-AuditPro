import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { addWorkingDays, defaultSeverity, scoreChecklist } from "@/lib/audit-scoring";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";

export type AuditListView = "full" | "summary" | "analytics" | "register";

const AUDIT_PROJECTIONS: Record<AuditListView, string | null> = {
  full: null,
  summary: "auditNumber department zone date totalScore status auditorName",
  analytics: "auditNumber zone department auditorName date status totalScore categoryScores checklist.category checklist.response",
  register: "auditNumber department zone date status checklist.questionId checklist.category checklist.question checklist.response checklist.observation checklist.severity"
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
  const query = user.role === "SPOC" && user.department ? { department: user.department } : {};
  const projection = AUDIT_PROJECTIONS[view] ?? AUDIT_PROJECTIONS.full;
  const request = Audit.find(query).sort({ date: -1 });
  if (projection) request.select(projection);
  return request.lean();
}

export async function createAudit(input: {
  zone: string;
  department: string;
  auditorName: string;
  date?: Date;
  checklist: Array<{
    questionId: string;
    category: string;
    question: string;
    response: "Adequate" | "Not Adequate" | "N/A";
    observation?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
    beforePhotos?: Array<{ secureUrl: string; publicId: string }>;
  }>;
}, user: SessionUser) {
  await connectDB();
  const { categoryScores, totalScore } = scoreChecklist(input.checklist);
  const audit = await Audit.create({
    auditNumber: await nextAuditNumber(),
    zone: input.zone,
    department: input.department,
    auditorName: input.auditorName,
    auditor: user.id,
    date: input.date || new Date(),
    status: "COMPLETED",
    checklist: input.checklist,
    categoryScores,
    totalScore,
    createdBy: user.id
  });

  const findings = await Finding.insertMany(input.checklist
    .filter((item) => item.response === "Not Adequate")
    .map((item, index) => ({
      findingNumber: `${audit.auditNumber}-F${String(index + 1).padStart(2, "0")}`,
      auditId: audit._id,
      auditNumber: audit.auditNumber,
      zone: audit.zone,
      department: audit.department,
      questionId: item.questionId,
      category: item.category,
      question: item.question,
      severity: item.severity || defaultSeverity(item.response, item.category),
      observation: item.observation,
      beforePhotos: item.beforePhotos || [],
      assignedTo: audit.department,
      dueDate: addWorkingDays(new Date(), 7),
      status: "OPEN",
      createdBy: user.id,
      timeline: [{ action: "Finding created", note: "Created from audit checklist", by: user.id, byName: user.name }]
    })));

  audit.findingIds = findings.map((finding) => finding._id);
  await audit.save();

  // Send Audit Completed Email (Async)
  resolveRecipients({ department: audit.department, roles: ["MASTER_ADMIN", "ADMIN", "MANAGEMENT", "AUDITOR"] })
    .then((recipients) => {
      if (user.email && !recipients.includes(user.email)) {
        recipients.push(user.email);
      }
      return sendTemplatedEmail({
        triggerEvent: "AUDIT_COMPLETED",
        recipients,
        data: {
          recipientName: "6S AuditPro Team",
          auditNumber: audit.auditNumber,
          departmentName: audit.department,
          zoneName: audit.zone,
          auditorName: audit.auditorName,
          status: audit.status,
          totalScore: `${audit.totalScore}%`
        },
        relatedAuditId: audit._id.toString()
      });
    })
    .catch((err) => console.error("Error sending audit completion email:", err));

  // Send Finding Assigned Emails (Async)
  for (const finding of findings) {
    resolveRecipients({ department: finding.department, roles: ["SPOC", "ADMIN", "MASTER_ADMIN"] })
      .then((spocRecipients) => {
        return sendTemplatedEmail({
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
      })
      .catch((err) => console.error(`Error sending finding assignment email for ${finding.findingNumber}:`, err));
  }

  return { audit, findings };
}
