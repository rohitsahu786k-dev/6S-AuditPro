import { requireUser } from "@/lib/auth";
import Person from "@/models/Person";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const personUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(["AUDITOR", "RESPONSIBLE"]).optional(),
  roleTitle: z.string().trim().optional(),
  department: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:update");
    const { id } = await context.params;
    const input = await parseJson(request, personUpdateSchema);
    await connectDB();
    const update = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.roleTitle !== undefined ? { roleTitle: input.roleTitle } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.status === undefined ? {} : { isActive: input.status === "active" })
    };
    const person = await Person.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!person) throw Object.assign(new Error("Person not found"), { status: 404 });
    return ok(person);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:delete");
    const { id } = await context.params;
    await connectDB();
    const person = await Person.findByIdAndDelete(id);
    if (!person) throw Object.assign(new Error("Person not found"), { status: 404 });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
