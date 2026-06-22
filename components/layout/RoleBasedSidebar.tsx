"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardCheck, Gauge, ListChecks, Mail, Settings } from "lucide-react";
import type { SessionUser } from "@/types/domain";
import { ROLE_ROUTES } from "@/lib/roles";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/audits", label: "Audits", icon: ClipboardCheck },
  { href: "/findings", label: "Findings", icon: ListChecks },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings },
  { href: "/admin/email-templates", label: "Email", icon: Mail }
];

export function RoleBasedSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const allowed = ROLE_ROUTES[user.role] || [];
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/favicon.png" alt="ONEPWS" />
        <div>
          <div className="brand-title">6S AuditPro</div>
          <div className="brand-sub">ONEPWS Pvt. Ltd.</div>
        </div>
      </div>
      <nav className="nav">
        {nav.filter((item) => allowed.some((route) => item.href === route || item.href.startsWith(`${route}/`))).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} className={active ? "active" : ""} href={item.href}>
              <Icon size={17} /> {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: 16, color: "var(--muted)", fontSize: 12 }}>
        IMS-16-04-L4-07 Rev.03<br />ONEPWS Private Limited
      </div>
    </aside>
  );
}
