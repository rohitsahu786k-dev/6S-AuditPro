import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

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
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <RoleBasedSidebar user={user} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header user={user} logoutAction={logoutAction} />
          <main className="flex-1 overflow-y-auto bg-background p-5 pb-[75px] md:pb-5">{children}</main>
        </div>
      </div>
      <BottomNav role={user.role} />
    </div>
  );
}
