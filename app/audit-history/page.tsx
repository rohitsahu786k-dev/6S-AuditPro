import { AppShell } from "@/components/layout/AppShell";
import { AuditWorkspace } from "@/components/audits/AuditWorkspace";

export default function AuditHistoryPage() {
  return <AppShell><AuditWorkspace historyOnly /></AppShell>;
}
