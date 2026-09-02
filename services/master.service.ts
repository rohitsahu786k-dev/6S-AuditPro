import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import { connectDB } from "@/lib/db";

const CATEGORY_ALIASES: Record<string, string> = {
  "1S": "SORT",
  "2S": "SET IN ORDER",
  "3S": "SHINE",
  "4S": "STANDARDIZE",
  "5S": "SUSTAIN",
  "6S": "SAFETY",
  "7S": "ENVIRONMENT"
};

function normalizeQuestionCategory<T extends { category?: string }>(question: T): T {
  return {
    ...question,
    category: CATEGORY_ALIASES[question.category || ""] || question.category
  };
}

export async function getMasters() {
  await connectDB();
  const [departments, zones, questions, people] = await Promise.all([
    Department.find().sort({ name: 1 }).lean(),
    Zone.find().sort({ department: 1, name: 1 }).lean(),
    Question.find().sort({ sortOrder: 1, category: 1 }).lean(),
    Person.find().sort({ type: 1, name: 1 }).lean()
  ]);
  return { departments, zones, questions: questions.map(normalizeQuestionCategory), people };
}
