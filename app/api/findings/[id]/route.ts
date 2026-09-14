import { requireUser } from "@/lib/auth";
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
  actionOwnerUserId?: unknown;
  beforePhotos?: unknown[];
};

function sameValue(left?: unknown, right?: unknown) {
  return String(left || "").trim().toLowerCase().replace(/\s+/g, " ") ===
    String(right || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Question ids drifted between builds: older findings kept a generated id while
 * the audit checklist kept the master question id. Falling back to the question
 * text keeps an edit in Findings flowing through to the audit checklist instead
 * of silently doing nothing when the two ids disagree.
 */
function matchesFinding(item: ChecklistItem, finding: {
  questionId?: unknown;
  category?: unknown;
  question?: unknown;
}) {
  if (item.questionId && finding.questionId && sameValue(item.questionId, finding.questionId)) return true;
  return sameValue(item.category, finding.category) && sameValue(item.question, finding.question);
}

/** The audit date lives on the audit, so the detail view joins it in. */
async function auditDateFor(finding: { auditId?: unknown; auditNumber?: string | null }) {
  if (!finding.auditId && !finding.auditNumber) return undefined;
  const audit = await Audit.findOne({
    $or: [
      ...(finding.auditId ? [{ _id: finding.auditId }] : []),
      ...(finding.auditNumber ? [{ auditNumber: finding.auditNumber }] : [])
    ]
  }).select("date startDate").lean();
  return (audit?.startDate || audit?.date) ?? undefined;
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
    item.actionOwnerUserId = finding.assignedUser;
    item.beforePhotos = finding.beforePhotos || [];
    audit.markModified("checklist");
  }

  await audit.save();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("findings:read");
    const { id } = await context.params;
    await connectDB();
    const finding = await Finding.findOne({
      _id: id,
      ...(user.role === "SPOC" && user.department ? { department: user.department } : {})
    }).lean();
    if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
    return ok({ ...finding, auditDate: await auditDateFor(finding) });
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
    const finding = await Finding.findOne({
      _id: id,
      ...(user.role === "SPOC" && user.department ? { department: user.department } : {})
    });
    if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
    
    const previousOwner = finding.assignedTo || "";
    const previousDepartment = finding.department;

    if (input.severity) finding.severity = input.severity;
    if (input.observation !== undefined) finding.observation = input.observation;
    if (input.department) finding.department = input.department;
    if (input.assignedTo !== undefined) finding.assignedTo = input.assignedTo;
    if (input.assignedUser !== undefined) finding.set("assignedUser", input.assignedUser || undefined);
    if (input.dueDate) finding.dueDate = input.dueDate;
    if (input.status) finding.status = input.status;
    if (input.beforePhotos) finding.beforePhotos = input.beforePhotos as any;
    if (input.afterPhotos) finding.afterPhotos = input.afterPhotos as any;
    
    finding.timeline.push({ 
      action: input.department || input.assignedTo !== undefined || input.assignedUser !== undefined
        ? "Responsible person transferred"
        : "Finding updated",
      note: input.department || input.assignedTo !== undefined
        ? `Owner changed from ${previousOwner || previousDepartment} / ${previousDepartment} to ${finding.assignedTo || finding.department} / ${finding.department}`
        : `Updated attributes by ${user.name}`,
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
    const user = await requireUser("findings:update");
    if (user.role !== "MASTER_ADMIN" && user.role !== "ADMIN") {
      throw Object.assign(new Error("Only admins can delete findings."), { status: 403 });
    }
    const { id } = await context.params;
    await connectDB();
    const finding = await Finding.findById(id);
    if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
    
    await Finding.deleteOne({ _id: id });
    if (finding.auditId || finding.auditNumber) {
      await Audit.updateOne(
        {
          $or: [
            ...(finding.auditId ? [{ _id: finding.auditId }] : []),
            ...(finding.auditNumber ? [{ auditNumber: finding.auditNumber }] : [])
          ]
        },
        { $pull: { findingIds: finding._id } }
      );
    }
    return ok({ success: true, message: `Finding ${finding.findingNumber} deleted successfully.` });
  } catch (error) {
    return fail(error);
  }
}
