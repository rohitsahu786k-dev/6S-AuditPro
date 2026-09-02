import { requireUser } from "@/lib/auth";
import { scoreChecklist } from "@/lib/audit-scoring";
import { findingUpdateSchema } from "@/lib/validators";
import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";

type ChecklistItem = {
  questionId?: string;
  category?: string;
  question?: string;
  response?: string;
  observation?: string;
  severity?: string;
  actionOwnerName?: string;
  actionOwnerDepartment?: string;
  beforePhotos?: unknown[];
};

function sameValue(left?: unknown, right?: unknown) {
  return String(left || "").trim() === String(right || "").trim();
}

function matchesFinding(item: ChecklistItem, finding: {
  questionId?: unknown;
  category?: unknown;
  question?: unknown;
}) {
  if (item.questionId && finding.questionId) return sameValue(item.questionId, finding.questionId);
  return sameValue(item.category, finding.category) && sameValue(item.question, finding.question);
}

async function syncLinkedAuditForFinding(finding: any) {
  if (!finding.auditId && !finding.auditNumber) return;

  const audit = await Audit.findOne({
    $or: [
      ...(finding.auditId ? [{ _id: finding.auditId }] : []),
      ...(finding.auditNumber ? [{ auditNumber: finding.auditNumber }] : [])
    ]
  });
  if (!audit) return;

  const item = (audit.checklist as ChecklistItem[]).find((entry) => matchesFinding(entry, finding));
  if (item) {
    item.observation = finding.observation;
    item.severity = finding.severity;
    item.actionOwnerName = finding.assignedTo || finding.department;
    item.actionOwnerDepartment = finding.department;
    item.beforePhotos = finding.beforePhotos || [];
    audit.markModified("checklist");
  }

  const scoredChecklist = (audit.checklist as ChecklistItem[]).filter((entry) => {
    if (entry.response !== "Not Adequate") return true;
    return !entry.actionOwnerDepartment || entry.actionOwnerDepartment === audit.department;
  });
  const { categoryScores, totalScore } = scoreChecklist(scoredChecklist as any);
  audit.categoryScores = categoryScores;
  audit.totalScore = totalScore;
  await audit.save();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("findings:read");
    const { id } = await context.params;
    await connectDB();
    const finding = await Finding.findById(id).lean();
    if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
    return ok(finding);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("findings:update");
    const { id } = await context.params;
    const input = await parseJson(request, findingUpdateSchema);
    await connectDB();
    const finding = await Finding.findById(id);
    if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
    
    if (input.severity) finding.severity = input.severity;
    if (input.observation) finding.observation = input.observation;
    if (input.department) finding.department = input.department;
    if (input.assignedTo) finding.assignedTo = input.assignedTo;
    if (input.dueDate) finding.dueDate = input.dueDate;
    if (input.status) finding.status = input.status;
    if (input.beforePhotos) finding.beforePhotos = input.beforePhotos as any;
    if (input.afterPhotos) finding.afterPhotos = input.afterPhotos as any;
    
    finding.timeline.push({ 
      action: "Finding updated", 
      note: `Updated attributes by ${user.name}`, 
      by: user.id, 
      byName: user.name, 
      at: new Date() 
    });
    
    const saved = await finding.save();
    await syncLinkedAuditForFinding(saved);
    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("findings:update");
    const { id } = await context.params;
    await connectDB();
    const finding = await Finding.findById(id);
    if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
    
    await Finding.deleteOne({ _id: id });
    return ok({ success: true, message: `Finding ${finding.findingNumber} deleted successfully.` });
  } catch (error) {
    return fail(error);
  }
}
