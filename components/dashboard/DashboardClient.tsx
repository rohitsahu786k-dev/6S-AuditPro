"use client";

import { useMemo } from "react";
import { useApi } from "@/hooks/useApi";

type Audit = { totalScore?: number; department?: string };
type Finding = { status: string; severity: string; department: string };

export function DashboardClient() {
  const audits = useApi<Audit[]>("/api/audits");
  const findings = useApi<Finding[]>("/api/findings");
  const auditList = audits.data || [];
  const findingList = findings.data || [];
  const stats = useMemo(() => {
    const closed = findingList.filter((f) => f.status === "CLOSED").length;
    return {
      audits: auditList.length,
      avgScore: auditList.length ? Math.round(auditList.reduce((sum, a) => sum + (a.totalScore || 0), 0) / auditList.length) : 0,
      open: findingList.filter((f) => !["CLOSED"].includes(f.status)).length,
      critical: findingList.filter((f) => f.severity === "Critical" && f.status !== "CLOSED").length,
      closure: findingList.length ? Math.round((closed / findingList.length) * 100) : 0
    };
  }, [auditList, findingList]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-sub">ONEPWS Private Limited - 6S Audit Control Centre</p>
        </div>
      </div>
      <div className="grid grid-3">
        <Kpi label="Total Audits" value={stats.audits} />
        <Kpi label="Avg Audit Score" value={`${stats.avgScore}%`} />
        <Kpi label="Open Findings" value={stats.open} />
        <Kpi label="Active Critical" value={stats.critical} />
        <Kpi label="Closure Rate" value={`${stats.closure}%`} />
        <Kpi label="System Status" value={audits.error || findings.error ? "Check env" : "Live"} />
      </div>
      {(audits.loading || findings.loading) ? <p className="muted">Loading dashboard...</p> : null}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card kpi"><span className="muted">{label}</span><span className="kpi-value">{value}</span></div>;
}
