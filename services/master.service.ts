import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import User from "@/models/User";
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

export async function getMasters(lookupOnly = false) {
  await connectDB();
  const departmentFields = lookupOnly ? "name isActive" : undefined;
  const zoneFields = lookupOnly ? "name department location isActive" : undefined;
  const questionFields = lookupOnly ? "category text subSection serialNumber sortOrder isActive" : undefined;
  const personFields = lookupOnly ? "name type roleTitle department zone isActive" : undefined;
  const userFields = lookupOnly ? "name username email department role status" : undefined;
  const [departments, zones, questions, people, users] = await Promise.all([
    Department.find().select(departmentFields || "").sort({ name: 1 }).lean(),
    Zone.find().select(zoneFields || "").sort({ department: 1, name: 1 }).lean(),
    Question.find().select(questionFields || "").sort({ category: 1, serialNumber: 1, sortOrder: 1 }).lean(),
    Person.find().select(personFields || "").sort({ type: 1, name: 1 }).lean(),
    User.find().select(userFields || "").sort({ department: 1, name: 1 }).lean()
  ]);
  return {
    departments: departments.map(withStatus),
    zones: zones.map(withStatus),
    questions: questions.map(normalizeQuestionCategory).map(withStatus),
    people: people.map(withStatus),
    users: users.map((user) => ({ ...user, isActive: user.status !== "inactive" }))
  };
}
