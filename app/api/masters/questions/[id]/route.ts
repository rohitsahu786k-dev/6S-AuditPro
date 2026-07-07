import { requireUser } from "@/lib/auth";
import Question from "@/models/Question";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import { z } from "zod";

const questionUpdateSchema = z.object({
  category: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1).optional(),
  subSection: z.string().trim().optional(),
  sortOrder: z.number().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:update");
    const { id } = await context.params;
    const input = await parseJson(request, questionUpdateSchema);
    await connectDB();
    const question = await Question.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!question) throw Object.assign(new Error("Question not found"), { status: 404 });
    return ok(question);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:delete");
    const { id } = await context.params;
    await connectDB();
    const question = await Question.findByIdAndDelete(id);
    if (!question) throw Object.assign(new Error("Question not found"), { status: 404 });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
