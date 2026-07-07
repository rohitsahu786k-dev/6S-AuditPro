"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import type { SessionUser } from "@/types/domain";
import { ROLE_LABELS } from "@/lib/roles";
import { ROLE_BADGE_STYLES } from "@/lib/status-styles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "@/components/layout/ChangePasswordDialog";

export function ProfileMenu({ user, logoutAction }: { user: SessionUser; logoutAction: () => Promise<void> }) {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const initials = user.name
    ? user.name.split(" ").filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2)
    : "US";
  const roleStyle = ROLE_BADGE_STYLES[user.role];
  const firstName = user.name?.split(" ")[0] || user.name;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg border border-bd bg-bg1 px-2.5 py-1.5 shadow-[var(--shadow-sm)] hover:bg-bg3 hover:border-bd2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-d text-xs font-bold text-white">
              {initials}
            </span>
            <span className="max-w-[90px] truncate text-xs font-semibold text-t1">{firstName}</span>
            <span
              className="rounded-xl border px-2.5 py-0.5 text-[10px] font-bold tracking-[.3px]"
              style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
            >
              {ROLE_LABELS[user.role]}
            </span>
            <ChevronDown size={14} className="text-t3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          <DropdownMenuLabel className="font-normal">
            <div className="text-[13px] font-bold text-t1">{user.name}</div>
            {user.department ? <div className="text-[11px] font-normal text-t2">{user.department}</div> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setChangePasswordOpen(true)}>
            <KeyRound size={14} /> Change Password
          </DropdownMenuItem>
          <DropdownMenuItem asChild variant="destructive">
            <form action={logoutAction} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2 text-left">
                <LogOut size={14} /> Logout
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
