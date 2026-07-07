import { requireUser } from "@/lib/auth";
import Zone from "@/models/Zone";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const zoneCreateSchema = z.object({
  name: z.string().trim().min(1),
  department: z.string().trim().min(1),
  location: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export async function POST(request: Request) {
  try {
    await requireUser("masters:create");
    const input = await parseJson(request, zoneCreateSchema);
    await connectDB();
    const zone = await Zone.create(input);
    return ok(zone, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
