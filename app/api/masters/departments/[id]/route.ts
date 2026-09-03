import { requireUser } from "@/lib/auth";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";
import { splitEmailList } from "@/lib/org-utils";

const departmentUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  managerEmails: z.union([z.string(), z.array(z.string())]).optional(),
  hodEmails: z.union([z.string(), z.array(z.string())]).optional(),
  managementEmails: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:update");
    const { id } = await context.params;
    const input = await parseJson(request, departmentUpdateSchema);
    await connectDB();
    const update = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.managerEmails !== undefined ? { managerEmails: splitEmailList(input.managerEmails) } : {}),
      ...(input.hodEmails !== undefined ? { hodEmails: splitEmailList(input.hodEmails) } : {}),
      ...(input.managementEmails !== undefined ? { managementEmails: splitEmailList(input.managementEmails) } : {}),
      ...(input.status === undefined ? {} : { isActive: input.status === "active" })
    };
    const department = await Department.findByIdAndUpdate(id, { $set: update }, { new: true });
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
