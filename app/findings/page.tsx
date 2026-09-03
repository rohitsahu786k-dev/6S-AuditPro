import { AppShell } from "@/components/layout/AppShell";
import { FindingsWorkspace } from "@/components/findings/FindingsWorkspace";
import { FindingsDateFilter } from "@/components/findings/FindingsDateFilter";

export default function FindingsPage() {
  return (
    <AppShell>
      <FindingsWorkspace />
      <FindingsDateFilter />
    </AppShell>
  );
}
