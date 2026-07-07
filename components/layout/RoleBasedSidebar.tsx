"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/types/domain";
import { ROLE_ROUTES } from "@/lib/roles";
import { isNavItemActive, navItemsForRoutes } from "@/lib/nav-items";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export function RoleBasedSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const allowed = ROLE_ROUTES[user.role] || [];
  const items = navItemsForRoutes(allowed);

  return (
    <aside className="flex w-[244px] shrink-0 flex-col overflow-y-auto border-r border-bd bg-bg1 shadow-[1px_0_0_var(--color-bd)]">
      <div className="flex items-center gap-2.5 border-b border-bd p-4">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] border border-[#fecaca] bg-white p-[5px] shadow-[0_2px_8px_rgba(239,43,45,.16)]">
          <img src="/favicon.png" alt="" className="block h-full w-full object-contain" />
        </div>
        <div>
          <div className="text-sm leading-tight font-bold text-t1">{APP_NAME}</div>
          <div className="text-[10px] text-t2">{COMPANY_NAME}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item.href);
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

      <div className="mt-auto border-t border-bd px-3.5 py-3 text-[10px] leading-relaxed text-t3">
        <div>IMS-16-04-L4-07 Rev.03</div>
        <div>{COMPANY_NAME}</div>
      </div>
    </aside>
  );
}
