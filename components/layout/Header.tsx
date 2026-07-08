"use client";

import { usePathname } from "next/navigation";
import { Bell, Home } from "lucide-react";
import type { SessionUser } from "@/types/domain";
import { breadcrumbLabel } from "@/lib/nav-items";
import { COMPANY_NAME } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

export function Header({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const currentLabel = breadcrumbLabel(pathname);

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-bd bg-bg1 px-5 py-2.5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-t2">
        <Home size={13} />
        <span>{COMPANY_NAME}</span>
        <span className="text-t3">›</span>
        <span className="font-semibold text-t1">{currentLabel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-bd bg-bg1 text-t2 shadow-[var(--shadow-sm)] hover:bg-bg3"
              aria-label="Notifications"
            >
              <Bell size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px]">
            <div className="px-2 py-6 text-center text-[13px] text-t2">No new notifications</div>
          </DropdownMenuContent>
        </DropdownMenu>
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
