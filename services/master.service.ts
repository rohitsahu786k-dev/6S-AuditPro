import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import { connectDB } from "@/lib/db";

function withStatus<T extends { isActive?: boolean }>(item: T) {
  return {
    ...item,
    status: item.isActive === false ? "inactive" : "active"
  };
}

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

function withStatus<T extends { isActive?: boolean }>(item: T) {
  return {
    ...item,
    status: item.isActive === false ? "inactive" : "active"
  };
}

export async function getMasters() {
  await connectDB();
  const [departments, zones, questions, people] = await Promise.all([
    Department.find().sort({ name: 1 }).lean(),
    Zone.find().sort({ department: 1, name: 1 }).lean(),
    Question.find().sort({ category: 1, serialNumber: 1, sortOrder: 1 }).lean(),
    Person.find().sort({ type: 1, name: 1 }).lean()
  ]);
  return {
    departments: departments.map(withStatus),
    zones: zones.map(withStatus),
    questions: questions.map(normalizeQuestionCategory).map(withStatus),
    people: people.map(withStatus)
  };
}
