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
  isActive: z.boolean().default(true),
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

function normalizeCategory(category: string) {
  return CATEGORY_ALIASES[category] || category;
}

export async function POST(request: Request) {
  try {
    await requireUser("masters:create");
    const input = await parseJson(request, questionCreateSchema);
    await connectDB();
    const { status, ...questionInput } = input;
    const question = await Question.create({
      ...questionInput,
      category: normalizeCategory(questionInput.category),
      isActive: status ? status === "active" : questionInput.isActive
    });
    return ok(question, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
