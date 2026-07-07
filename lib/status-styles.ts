import type { CSSProperties } from "react";
import type { FindingStatus, Role, Severity } from "@/types/domain";

type BadgeStyle = { bg: string; text: string; border: string };

export const ROLE_BADGE_STYLES: Record<Role, BadgeStyle> = {
  MASTER_ADMIN: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  ADMIN: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  AUDITOR: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  STORES_SPOC: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  PRODUCTION_SPOC: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  MANAGEMENT: { bg: "#ecfdf5", text: "#047857", border: "#6ee7b7" },
};

export const SEVERITY_BADGE_STYLES: Record<Severity, BadgeStyle> = {
  Critical: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  High: { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  Medium: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  Low: { bg: "#f0f4f8", text: "#4b5563", border: "#d0d7de" },
};

export const STATUS_BADGE_STYLES: Record<FindingStatus, BadgeStyle> = {
  OPEN: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  REOPENED: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  IN_PROGRESS: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  SUBMITTED: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  CLOSED: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  REJECTED: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  OVERDUE: { bg: "#f3e8ff", text: "#6d28d9", border: "#c4b5fd" },
};

export function scoreBadgeStyle(score: number): BadgeStyle {
  if (score >= 90) return { bg: "#dcfce7", text: "#15803d", border: "#86efac" };
  if (score >= 75) return { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" };
  if (score >= 60) return { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" };
  return { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" };
}

export function badgeStyleToVars(style: BadgeStyle): CSSProperties {
  return {
    backgroundColor: style.bg,
    color: style.text,
    borderColor: style.border,
  };
}
