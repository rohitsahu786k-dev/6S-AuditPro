import { requireUser } from "@/lib/auth";
import Department from "@/models/Department";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";
import { splitEmailList } from "@/lib/org-utils";

const departmentCreateSchema = z.object({
  name: z.string().trim().min(1),
  managerEmails: z.union([z.string(), z.array(z.string())]).optional(),
  hodEmails: z.union([z.string(), z.array(z.string())]).optional(),
  managementEmails: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export async function POST(request: Request) {
  try {
    await requireUser("masters:create");
    const input = await parseJson(request, departmentCreateSchema);
    await connectDB();
    const department = await Department.create({
      name: input.name,
      managerEmails: splitEmailList(input.managerEmails),
      hodEmails: splitEmailList(input.hodEmails),
      managementEmails: splitEmailList(input.managementEmails),
      isActive: input.status === "active"
    });
    return ok(department, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
