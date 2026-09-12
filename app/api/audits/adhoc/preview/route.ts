import { requireUser } from "@/lib/auth";
import { validateAdhocWorkbook, MAX_ADHOC_EXCEL_BYTES } from "@/lib/adhoc-excel";
import { connectDB } from "@/lib/db";
import Department from "@/models/Department";
import User from "@/models/User";
import { fail, ok } from "@/utils/api";

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "text/csv",
  "application/csv",
  "text/plain"
]);

export async function POST(request: Request) {
  try {
    await requireUser("audits:create");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw Object.assign(new Error("CSV or Excel file is required."), { status: 400 });
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls") && !lowerName.endsWith(".csv")) {
      throw Object.assign(new Error("Only .csv, .xlsx or .xls files are supported."), { status: 400 });
    }
    if (file.size <= 0) throw Object.assign(new Error("Import file is empty."), { status: 400 });
    if (file.size > MAX_ADHOC_EXCEL_BYTES) {
      throw Object.assign(new Error("Import file is too large. Maximum size is 5 MB."), { status: 400 });
    }
    if (file.type && !EXCEL_MIME_TYPES.has(file.type)) {
      throw Object.assign(new Error("Invalid import file type."), { status: 400 });
    }

    await connectDB();
    const [departments, users] = await Promise.all([
      Department.find({ isActive: { $ne: false } }).select("name").lean(),
      User.find({ status: { $ne: "inactive" } }).select("name username email department status").lean()
    ]);
    const buffer = Buffer.from(await file.arrayBuffer());
    return ok(validateAdhocWorkbook({
      buffer,
      fileName: file.name,
      departments: departments.map((department) => department.name).filter(Boolean),
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        username: user.username,
        email: user.email || undefined,
        department: user.department || undefined,
        status: user.status
      }))
    }));
  } catch (error) {
    return fail(error);
  }
}
