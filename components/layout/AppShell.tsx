import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";

async function logoutAction() {
  "use server";
  const { clearSessionCookie } = await import("@/lib/auth");
  await clearSessionCookie();
  redirect("/login");
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="shell">
      <RoleBasedSidebar user={user} />
      <div className="content">
        <header className="topbar">
          <div>
            <strong>{user.name}</strong>
            <div className="muted" style={{ fontSize: 12 }}>{ROLE_LABELS[user.role]}{user.department ? ` • ${user.department}` : ""}</div>
          </div>
          <form action={logoutAction}>
            <button className="btn" type="submit"><LogOut size={16} /> Logout</button>
          </form>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
