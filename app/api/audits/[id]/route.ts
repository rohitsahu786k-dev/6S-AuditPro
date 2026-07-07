import { requireUser } from "@/lib/auth";
import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { fail, ok } from "@/utils/api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("audits:read");
    const { id } = await context.params;
    await connectDB();
    const audit = await Audit.findById(id).lean();
    if (!audit) throw Object.assign(new Error("Audit not found"), { status: 404 });
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
