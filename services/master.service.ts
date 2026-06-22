import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import { connectDB } from "@/lib/db";

export async function getMasters() {
  await connectDB();
  const [departments, zones, questions, people] = await Promise.all([
    Department.find().sort({ name: 1 }).lean(),
    Zone.find().sort({ department: 1, name: 1 }).lean(),
    Question.find().sort({ category: 1, sortOrder: 1 }).lean(),
    Person.find().sort({ type: 1, name: 1 }).lean()
  ]);
  return { departments, zones, questions, people };
}
