import { requireUser } from "@/lib/auth";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { PERMISSION_GROUPS, ROUTE_CATALOG, ALWAYS_ALLOWED_ROUTES, LOCKED_ROLE } from "@/lib/permission-catalog";
import { getRoleConfigs, resetRoleConfig, saveRoleConfig } from "@/services/role-config.service";
import { roleConfigSchema } from "@/lib/validators";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { fail, ok, parseJson } from "@/utils/api";
import type { Permission, Role, SessionUser } from "@/types/domain";

/**
 * Editing the role table is restricted to the Master Admin role itself rather than
 * to a permission. A permission can be granted to another role from this very
 * screen, so gating on one would let an administrator widen their own access and
 * then keep widening it. The role is the boundary that cannot be edited away.
 */
function assertCanEdit(user: SessionUser) {
  if (user.role !== LOCKED_ROLE) {
    throw Object.assign(new Error("Only a Master Admin can change role permissions."), { status: 403 });
  }
}

export async function GET() {
  try {
    const user = await requireUser("settings:manage");
    const configs = await getRoleConfigs();
    await connectDB();

    // How many people each change actually affects, shown next to the role.
    const counts = await User.aggregate<{ _id: Role; total: number }>([
      { $match: { status: "active" } },
      { $group: { _id: "$role", total: { $sum: 1 } } }
    ]);
    const accountsByRole = new Map(counts.map((row) => [row._id, row.total]));

    return ok({
      canEdit: user.role === LOCKED_ROLE,
      lockedRole: LOCKED_ROLE,
      alwaysAllowedRoutes: ALWAYS_ALLOWED_ROUTES,
      permissionGroups: PERMISSION_GROUPS,
      routeCatalog: ROUTE_CATALOG,
      roles: ROLES.map((role) => {
        const config = configs.get(role)!;
        return {
          role,
          label: ROLE_LABELS[role],
          locked: role === LOCKED_ROLE,
          activeAccounts: accountsByRole.get(role) || 0,
          permissions: config.permissions,
          routes: config.routes,
          customised: config.customised,
          updatedByName: config.updatedByName,
          updatedAt: config.updatedAt
        };
      })
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser("settings:manage");
    assertCanEdit(user);
    const input = await parseJson(request, roleConfigSchema);
    const saved = await saveRoleConfig(
      input.role as Role,
      // saveRoleConfig filters both against the catalogue, so the cast only says
      // what that filter guarantees.
      { permissions: input.permissions as Permission[], routes: input.routes },
      { id: user.id, name: user.name }
    );
    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}

/** Drops the override so the role returns to the defaults shipped in the code. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser("settings:manage");
    assertCanEdit(user);
    const role = new URL(request.url).searchParams.get("role") || "";
    if (!ROLES.includes(role as Role)) throw Object.assign(new Error("Unknown role"), { status: 400 });
    return ok(await resetRoleConfig(role as Role));
  } catch (error) {
    return fail(error);
  }
}

