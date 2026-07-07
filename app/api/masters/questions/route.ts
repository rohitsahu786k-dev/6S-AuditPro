import { requireUser } from "@/lib/auth";
import Question from "@/models/Question";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const questionCreateSchema = z.object({
  category: z.string().trim().min(1),
  text: z.string().trim().min(1),
  subSection: z.string().trim().optional(),
  sortOrder: z.number().default(0),
  status: z.enum(["active", "inactive"]).default("active")
});

export async function POST(request: Request) {
  try {
    await requireUser("masters:create");
    const input = await parseJson(request, questionCreateSchema);
    await connectDB();
    const question = await Question.create(input);
    return ok(question, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
