import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { FindingsWorkspace } from "@/components/findings/FindingsWorkspace";
import { FindingsDateFilter } from "@/components/findings/FindingsDateFilter";

export default function FindingsPage() {
  return (
    <AppShell>
      <FindingsWorkspace />
      <Suspense fallback={null}>
        <FindingsDateFilter />
      </Suspense>
    </AppShell>
  );
}
