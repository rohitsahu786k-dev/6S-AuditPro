import { requireUser } from "@/lib/auth";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const departmentUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:update");
    const { id } = await context.params;
    const input = await parseJson(request, departmentUpdateSchema);
    await connectDB();
    const department = await Department.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!department) throw Object.assign(new Error("Department not found"), { status: 404 });
    return ok(department);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:delete");
    const { id } = await context.params;
    await connectDB();
    const department = await Department.findByIdAndDelete(id);
    if (!department) throw Object.assign(new Error("Department not found"), { status: 404 });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
