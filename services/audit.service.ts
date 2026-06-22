import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { addWorkingDays, defaultSeverity, scoreChecklist } from "@/lib/audit-scoring";
import type { SessionUser } from "@/types/domain";

export async function nextAuditNumber() {
  const year = new Date().getFullYear();
  const prefix = `6S-${year}-`;
  const last = await Audit.findOne({ auditNumber: new RegExp(`^${prefix}`) }).sort({ createdAt: -1 }).lean();
  const seq = last?.auditNumber ? Number(last.auditNumber.split("-").pop()) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function listAudits(user: SessionUser) {
  await connectDB();
  const query = user.role.endsWith("_SPOC") && user.department ? { department: user.department } : {};
  return Audit.find(query).sort({ date: -1 }).lean();
}

export async function createAudit(input: {
  zone: string; department: string; auditorName: string; date?: Date; checklist: Array<{ questionId: string; category: string; question: string; response: "Adequate" | "Not Adequate" | "N/A"; observation?: string; severity?: "Critical" | "High" | "Medium" | "Low" }>;
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
      assignedTo: audit.department,
      dueDate: addWorkingDays(new Date(), 7),
      status: "OPEN",
      createdBy: user.id,
      timeline: [{ action: "Finding created", note: "Created from audit checklist", by: user.id, byName: user.name }]
    })));

  audit.findingIds = findings.map((finding) => finding._id);
  await audit.save();
  return { audit, findings };
}
