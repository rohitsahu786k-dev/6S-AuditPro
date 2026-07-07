import { requireUser } from "@/lib/auth";
import { findingUpdateSchema } from "@/lib/validators";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";

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
    
    await finding.save();
    return ok(finding);
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
