import { requireUser } from "@/lib/auth";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const departmentCreateSchema = z.object({
  name: z.string().trim().min(1),
  status: z.enum(["active", "inactive"]).default("active")
});

export async function POST(request: Request) {
  try {
    await requireUser("masters:create");
    const input = await parseJson(request, departmentCreateSchema);
    await connectDB();
    const department = await Department.create(input);
    return ok(department, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
