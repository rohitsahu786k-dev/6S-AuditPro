import type { LucideIcon } from "lucide-react";
import { BarChart3, ClipboardCheck, Gauge, Image, ListChecks, Mail, Settings } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/audits", label: "Audits", icon: ClipboardCheck },
  { href: "/findings", label: "Findings", icon: ListChecks },
  { href: "/media", label: "Media Manager", icon: Image },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings },
  { href: "/admin/email-templates", label: "Email", icon: Mail },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navItemsForRoutes(allowed: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => allowed.some((route) => item.href === route || item.href.startsWith(`${route}/`)));
}

export function breadcrumbLabel(pathname: string): string {
  const match = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "Overview";
}
