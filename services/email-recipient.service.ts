import User from "@/models/User";
import Department from "@/models/Department";
import Person from "@/models/Person";
import { connectDB } from "@/lib/db";
import type { Role } from "@/types/domain";
import { canonicalDepartmentName, splitEmailList } from "@/lib/org-utils";

export async function resolveRecipients(options: { department?: string; roles?: Role[]; assignedEmail?: string }) {
  await connectDB();
  const emails = new Set<string>();
  for (const email of splitEmailList(options.assignedEmail)) emails.add(email);

  const departments = await Department.find().select("name managerEmails hodEmails managementEmails").lean();
  const departmentNames = departments.map((department) => department.name).filter(Boolean);
  const department = canonicalDepartmentName(options.department, departmentNames);
  const departmentConfig = departments.find((item) => item.name === department);

  if (departmentConfig && options.roles?.some((role) => role === "MANAGEMENT")) {
    for (const email of splitEmailList(departmentConfig.managerEmails)) emails.add(email);
    for (const email of splitEmailList(departmentConfig.hodEmails)) emails.add(email);
    for (const email of splitEmailList(departmentConfig.managementEmails)) emails.add(email);
  }

  const roleQuery = options.roles?.length ? { role: { $in: options.roles } } : {};
  const departmentAliases = [...new Set([options.department, department].filter(Boolean))];
  const deptQuery = departmentAliases.length ? { $or: [{ department: { $in: departmentAliases } }, { department: "All" }, { department: { $exists: false } }] } : {};
  const users = await User.find({ status: "active", email: { $exists: true, $ne: "" }, ...roleQuery, ...deptQuery }).lean();
  for (const user of users) {
    for (const email of splitEmailList(user.email)) emails.add(email);
  }

  const people = await Person.find({
    isActive: { $ne: false },
    email: { $exists: true, $ne: "" },
    ...(departmentAliases.length ? { $or: [{ department: { $in: departmentAliases } }, { department: "" }, { department: { $exists: false } }] } : {})
  }).lean();
  for (const person of people) {
    const title = String(person.roleTitle || person.type || "").toLowerCase();
    const includeResponsible = options.roles?.includes("SPOC") && person.type === "RESPONSIBLE";
    const includeManager = options.roles?.includes("MANAGEMENT") && /\b(manager|hod|management)\b/i.test(title);
    if (includeResponsible || includeManager) {
      for (const email of splitEmailList(person.email)) emails.add(email);
    }
  }
  return [...emails];
}
