import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { allowedRoutesFor, getSessionUser, isRouteAllowed } from "@/lib/auth";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Page authorisation lives here rather than in the proxy. The proxy runs on the
  // edge and cannot read the administrator-managed role table, so a page granted
  // from the Permissions screen would stay blocked there. One authoritative check
  // also means the navigation and the guard can never disagree about what is
  // reachable — they are handed the same list.
  const allowed = await allowedRoutesFor(user);
  const pathname = (await headers()).get("x-pathname") || "";
  if (pathname && !isRouteAllowed(pathname, allowed)) redirect("/dashboard");

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <RoleBasedSidebar allowedRoutes={allowed} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header user={user} />
          <main className="flex-1 overflow-y-auto bg-background p-5 pb-[75px] md:pb-5">{children}</main>
        </div>
      </div>
      <BottomNav allowedRoutes={allowed} />
    </div>
  );
}
