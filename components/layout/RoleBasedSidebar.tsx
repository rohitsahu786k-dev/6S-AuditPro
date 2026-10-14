"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { activeNavHref, navItemsForRoutes } from "@/lib/nav-items";
import { COMPANY_NAME } from "@/lib/constants";

export function RoleBasedSidebar({ allowedRoutes }: { allowedRoutes: string[] }) {
  const pathname = usePathname();
  const allowed = allowedRoutes;
  const items = navItemsForRoutes(allowed);
  const activeHref = activeNavHref(pathname, items);

  return (
    <aside className="sticky top-0 flex h-screen w-[244px] shrink-0 flex-col overflow-y-auto border-r border-bd bg-bg1 shadow-[1px_0_0_var(--color-bd)]">
      <div className="border-b border-bd p-4">
        <img src="/onepws-dark-logo-scaled.png" alt={COMPANY_NAME} className="block h-auto w-full max-w-[160px]" />
      </div>

      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "mx-1 my-0.5 flex items-center gap-2.5 rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-semibold text-brand"
                  : "mx-1 my-0.5 flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-medium text-t2 hover:bg-bg3 hover:text-t1"
              }
            >
              <Icon size={15} className="w-[18px] shrink-0 text-center" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-2 border-t border-bd/60">
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-t3">Help</p>
        <Link
          href="/ocp-manual"
          className={
            pathname === "/ocp-manual"
              ? "mx-1 flex items-center gap-2.5 rounded-lg border border-brand bg-accent px-3.5 py-2.5 text-[13px] font-semibold text-brand shadow-xs"
              : "mx-1 flex items-center gap-2.5 rounded-lg border border-brand/60 bg-brand/5 px-3.5 py-2.5 text-[13px] font-semibold text-brand hover:border-brand hover:bg-brand/10 transition"
          }
        >
          <BookOpen size={15} className="w-[18px] shrink-0 text-center text-brand" />
          <span>OCP Manual</span>
        </Link>
      </div>

      <div className="mt-auto border-t border-bd px-3.5 py-3 text-[10px] leading-relaxed text-t3">
        <div>IMS-16-04-L4-07 Rev.03</div>
        <div>{COMPANY_NAME}</div>
      </div>
    </aside>
  );
}