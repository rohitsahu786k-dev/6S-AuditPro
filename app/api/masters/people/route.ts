import { requireUser } from "@/lib/auth";
import Person from "@/models/Person";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const personCreateSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["AUDITOR", "RESPONSIBLE"]),
  department: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export async function POST(request: Request) {
  try {
    await requireUser("masters:create");
    const input = await parseJson(request, personCreateSchema);
    await connectDB();
    const person = await Person.create(input);
    return ok(person, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
