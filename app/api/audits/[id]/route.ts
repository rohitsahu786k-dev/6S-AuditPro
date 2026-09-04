import { requireUser } from "@/lib/auth";
import { auditUpdateSchema } from "@/lib/validators";
import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";

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
    return ok(audit);
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

    await audit.save();
    return ok(audit);
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
    
    // Remove all associated findings
    if (audit.findingIds && audit.findingIds.length > 0) {
      await Finding.deleteMany({ _id: { $in: audit.findingIds } });
    }
    
    await Audit.deleteOne({ _id: id });
    return ok({ success: true, message: `Audit ${audit.auditNumber} and all related findings deleted successfully.` });
  } catch (error) {
    return fail(error);
  }
}
