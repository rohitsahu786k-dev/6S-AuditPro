import { requireUser } from "@/lib/auth";
import { auditUpdateSchema } from "@/lib/validators";
import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { calculateDepartmentAuditScore } from "@/lib/audit-scoring";
import { fail, ok, parseJson } from "@/utils/api";

async function withCanonicalScore(audit: any) {
  const findings = await Finding.find({
    $or: [
      { auditId: audit._id },
      { auditNumber: audit.auditNumber },
      { department: audit.department }
    ]
  }).select("_id auditId auditNumber department questionId category question").lean();
  const sourceAudits = await Audit.find({
    $or: [
      { _id: { $in: findings.map((finding) => finding.auditId).filter(Boolean) } },
      { auditNumber: { $in: findings.map((finding) => finding.auditNumber).filter(Boolean) } }
    ]
  }).select("_id auditNumber department").lean();
  const sourceDepartmentByAuditId = new Map(sourceAudits.map((source) => [String(source._id), source.department]));
  const sourceDepartmentByAuditNumber = new Map(sourceAudits.map((source) => [source.auditNumber, source.department]));
  const scoring = calculateDepartmentAuditScore({
    audit,
    department: audit.department,
    findings,
    sourceDepartmentByAuditId,
    sourceDepartmentByAuditNumber
  });

  return {
    ...audit,
    totalScore: scoring.score,
    categoryScores: scoring.categoryScores,
    adequateCount: scoring.adequateCount,
    ownedNotAdequateCount: scoring.ownedNotAdequateCount,
    applicableCount: scoring.applicableCount,
    naCount: scoring.naCount
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("audits:read");
    const { id } = await context.params;
    await connectDB();
    const audit = await Audit.findOne({
      _id: id,
      ...(user.role === "SPOC" && user.department ? { department: user.department } : {})
    }).lean();
    if (!audit) throw Object.assign(new Error("Audit not found"), { status: 404 });
    return ok(await withCanonicalScore(audit));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("audits:update");
    const { id } = await context.params;
    const input = await parseJson(request, auditUpdateSchema);
    await connectDB();

    const audit = await Audit.findById(id);
    if (!audit) throw Object.assign(new Error("Audit not found"), { status: 404 });

    const startDate = input.startDate || input.date;
    if (startDate) {
      audit.startDate = startDate;
      audit.date = startDate;
    }
    if (Object.prototype.hasOwnProperty.call(input, "endDate")) {
      audit.endDate = input.endDate ?? null;
    }

    const effectiveStartDate = audit.startDate || audit.date;
    if (effectiveStartDate && audit.endDate && audit.endDate < effectiveStartDate) {
      throw Object.assign(new Error("Ending Date cannot be earlier than Starting Date."), { status: 400 });
    }

    const saved = await audit.save();
    return ok(await withCanonicalScore(saved.toObject()));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    // Only Master Admin / authorized roles can delete audits
    await requireUser("audits:delete");
    const { id } = await context.params;
    await connectDB();
    
    const audit = await Audit.findById(id);
    if (!audit) throw Object.assign(new Error("Audit not found"), { status: 404 });
    
    // findingIds is a denormalised cache and drifts: findings raised after the list
    // was last written, or whose id was pulled from it, keep a live auditId while
    // dropping out of the array. Deleting by the array alone left those rows behind
    // pointing at an audit that no longer exists, where they still counted towards
    // department scores. Match on the back-references instead.
    await Finding.deleteMany({
      $or: [
        { _id: { $in: audit.findingIds || [] } },
        { auditId: audit._id },
        ...(audit.auditNumber ? [{ auditNumber: audit.auditNumber }] : [])
      ]
    });

    await Audit.deleteOne({ _id: id });
    return ok({ success: true, message: `Audit ${audit.auditNumber} and all related findings deleted successfully.` });
  } catch (error) {
    return fail(error);
  }
}
