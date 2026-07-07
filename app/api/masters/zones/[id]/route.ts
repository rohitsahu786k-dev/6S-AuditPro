import { requireUser } from "@/lib/auth";
import Zone from "@/models/Zone";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const zoneUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  location: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:update");
    const { id } = await context.params;
    const input = await parseJson(request, zoneUpdateSchema);
    await connectDB();
    const zone = await Zone.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!zone) throw Object.assign(new Error("Zone not found"), { status: 404 });
    return ok(zone);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:delete");
    const { id } = await context.params;
    await connectDB();
    const zone = await Zone.findByIdAndDelete(id);
    if (!zone) throw Object.assign(new Error("Zone not found"), { status: 404 });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
