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
  isActive: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const CATEGORY_ALIASES: Record<string, string> = {
  "1S": "SORT",
  "2S": "SET IN ORDER",
  "3S": "SHINE",
  "4S": "STANDARDIZE",
  "5S": "SUSTAIN",
  "6S": "SAFETY",
  "7S": "ENVIRONMENT"
};

function normalizeCategory(category?: string) {
  return category ? CATEGORY_ALIASES[category] || category : undefined;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("masters:update");
    const { id } = await context.params;
    const input = await parseJson(request, questionUpdateSchema);
    await connectDB();
    const { status, ...questionInput } = input;
    const update = {
      ...questionInput,
      ...(questionInput.category ? { category: normalizeCategory(questionInput.category) } : {}),
      ...(status ? { isActive: status === "active" } : {})
    };
    const question = await Question.findByIdAndUpdate(id, { $set: update }, { new: true });
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
