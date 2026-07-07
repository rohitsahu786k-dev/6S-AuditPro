"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types/domain";
import { ROLE_ROUTES } from "@/lib/roles";
import { isNavItemActive, navItemsForRoutes } from "@/lib/nav-items";

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const allowed = ROLE_ROUTES[role] || [];
  const items = navItemsForRoutes(allowed);

  return (
    <nav
      className="flex shrink-0 border-t border-bd bg-bg1 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--color-bd)] md:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[9px] font-medium text-brand"
                : "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[9px] font-medium text-t3"
            }
          >
            <Icon size={19} />
            <span className="truncate">{item.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
