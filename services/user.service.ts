import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { permissionsForRole } from "@/lib/roles";
import type { Role } from "@/types/domain";

export async function listUsers() {
  await connectDB();
  return User.find().sort({ createdAt: -1 }).lean();
}

export async function createUser(input: {
  name: string; username: string; email?: string; password: string; role: Role; department?: string; zone?: string; status?: "active" | "inactive";
}) {
  await connectDB();
  const passwordHash = await hashPassword(input.password);
  return User.create({
    name: input.name,
    username: input.username.toLowerCase(),
    email: input.email || undefined,
    passwordHash,
    role: input.role,
    department: input.department,
    zone: input.zone,
    status: input.status || "active",
    permissions: permissionsForRole(input.role),
    passwordChangedAt: new Date()
  });
}

export async function updateUser(id: string, input: Partial<{
  name: string; username: string; email?: string; password: string; role: Role; department?: string; zone?: string; status: "active" | "inactive";
}>) {
  await connectDB();
  const update: Record<string, unknown> = { ...input };
  if (input.username) update.username = input.username.toLowerCase();
  if (input.role) update.permissions = permissionsForRole(input.role);
  if (input.password) {
    update.passwordHash = await hashPassword(input.password);
    update.passwordChangedAt = new Date();
    delete update.password;
  }
  return User.findByIdAndUpdate(id, update, { new: true });
}

export async function deactivateUser(id: string) {
  await connectDB();
  const user = await User.findById(id);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (user.role === "MASTER_ADMIN") {
    const activeMasters = await User.countDocuments({ role: "MASTER_ADMIN", status: "active", _id: { $ne: id } });
    if (activeMasters === 0) throw Object.assign(new Error("Cannot disable the last active Master Admin"), { status: 400 });
  }
  user.status = "inactive";
  return user.save();
}
