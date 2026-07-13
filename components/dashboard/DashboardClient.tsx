"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { FolderOpen, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Eye, Plus, FileDown } from "lucide-react";
import { downloadInsightsPdf } from "@/lib/insights-pdf";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AuditListCard } from "@/components/dashboard/AuditListCard";
import { FindingListCard } from "@/components/dashboard/FindingListCard";
import { COMPANY_NAME } from "@/lib/constants";

type Audit = {
  _id: string;
  auditNumber: string;
  department: string;
  zone: string;
  date: string;
  totalScore: number;
  status: string;
  auditorName: string;
};

type Finding = {
  _id: string;
  findingNumber: string;
  department: string;
  zone: string;
  severity: string;
  status: string;
  question: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#64748b"
};

const COMPLIANCE_TARGET = 90;

const TH_CLASS = "bg-bg3 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-t2";
const TH_RIGHT_CLASS = "bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2";
const TD_CLASS = "border-b border-[#edf0f4] px-2 py-2";

const DASHBOARD_YEAR = new Date().getFullYear();
const CURRENT_MONTH_INDEX = new Date().getMonth();
const YEAR_MONTHS = Array.from({ length: 12 }, (_, index) => ({
  key: `${DASHBOARD_YEAR}-${String(index + 1).padStart(2, "0")}`,
  label: new Date(DASHBOARD_YEAR, index, 1).toLocaleString("en", { month: "short" }),
  end: new Date(DASHBOARD_YEAR, index + 1, 0, 23, 59, 59, 999),
  // Future months carry no data yet and must render blank on the dashboard.
  isFuture: index > CURRENT_MONTH_INDEX
}));

function monthKeyOf(isoDate?: string) {
  return isoDate ? isoDate.slice(0, 7) : "";
}

function trendDelta(values: Array<number | null>, index: number): number | null {
  if (index === 0) return null;
  const current = values[index];
  const previous = values[index - 1];
  if (current === null || previous === null) return null;
  const delta = current - previous;
  return delta === 0 ? null : delta;
}

function MonthlyDepartmentTable({
  rows,
  valueSuffix = "",
  emptyMessage,
  showTrend = false
}: {
  rows: Array<{ department: string; values: Array<number | null> }>;
  valueSuffix?: string;
  emptyMessage: string;
  showTrend?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="flex min-h-32 items-center justify-center text-sm text-t2">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-bd">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead>
          <tr>
            <th className={`${TH_CLASS} sticky left-0 z-10 min-w-40`}>Department</th>
            {YEAR_MONTHS.map((month) => (
              <th key={month.key} className={`${TH_RIGHT_CLASS} min-w-14`}>{month.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.department}>
              <td className={`${TD_CLASS} sticky left-0 bg-white font-bold text-t1`}>{row.department}</td>
              {row.values.map((value, index) => {
                const delta = showTrend ? trendDelta(row.values, index) : null;
                return (
                  <td
                    key={YEAR_MONTHS[index].key}
                    className={`${TD_CLASS} text-right font-semibold ${
                      value === null ? "text-t3" : value >= 80 ? "text-green" : value >= 50 ? "text-orange" : "text-red"
                    }`}
                  >
                    {value === null ? "-" : `${value}${valueSuffix}`}
                    {delta !== null && (
                      <span className={`ml-0.5 align-middle text-[9px] font-extrabold ${delta > 0 ? "text-green" : "text-red"}`}>
                        {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardClient() {
  const auditsApi = useApi<Audit[]>("/api/audits?view=summary");
  const findingsApi = useApi<Finding[]>("/api/findings?view=summary");

  const audits = auditsApi.data || [];
  const findings = findingsApi.data || [];

  const stats = useMemo(() => {
    const open = findings.filter((f) => f.status === "OPEN" || f.status === "REOPENED").length;
    const inProgress = findings.filter((f) => f.status === "IN_PROGRESS").length;
    const closed = findings.filter((f) => f.status === "CLOSED").length;
    const overdue = findings.filter((f) => f.status === "OVERDUE").length;
    const criticalActive = findings.filter((f) => f.status !== "CLOSED" && f.severity === "Critical").length;
    const pendingReview = findings.filter((f) => f.status === "SUBMITTED").length;
    return { open, inProgress, closed, overdue, criticalActive, pendingReview };
  }, [findings]);

  const severityBreakdown = useMemo(() => {
    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => ({ name: severity, value: count }));
  }, [findings]);

  const departmentSummary = useMemo(() => {
    const map = new Map<string, { total: number; open: number; inProcess: number; closed: number; delayed: number; scoreSum: number; scoreCount: number }>();
    for (const f of findings) {
      const row = map.get(f.department) || { total: 0, open: 0, inProcess: 0, closed: 0, delayed: 0, scoreSum: 0, scoreCount: 0 };
      row.total += 1;
      if (f.status === "OPEN" || f.status === "REOPENED" || f.status === "OVERDUE" || f.status === "SUBMITTED") row.open += 1;
      if (f.status === "IN_PROGRESS") row.inProcess += 1;
      if (f.status === "CLOSED") row.closed += 1;
      if (f.status === "OVERDUE") row.delayed += 1;
      map.set(f.department, row);
    }
    for (const a of audits) {
      if (a.status !== "COMPLETED") continue;
      const row = map.get(a.department) || { total: 0, open: 0, inProcess: 0, closed: 0, delayed: 0, scoreSum: 0, scoreCount: 0 };
      row.scoreSum += a.totalScore || 0;
      row.scoreCount += 1;
      map.set(a.department, row);
    }
    return [...map.entries()]
      .map(([department, row]) => {
        const auditScore = row.scoreCount ? Math.round(row.scoreSum / row.scoreCount) : 0;
        const closurePct = row.total ? Math.round((row.closed / row.total) * 100) : 0;
        return {
          department,
          total: row.total,
          open: row.open,
          inProcess: row.inProcess,
          closed: row.closed,
          delayed: row.delayed,
          auditScore,
          closurePct,
          compliant: auditScore >= COMPLIANCE_TARGET
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [findings, audits]);

  // Month-wise average audit score per department for the current calendar year.
  const monthlyAuditScore = useMemo(() => {
    const completed = audits.filter((a) => a.status === "COMPLETED");
    const departments = [...new Set(completed.map((a) => a.department))].sort();
    return departments.map((department) => ({
      department,
      values: YEAR_MONTHS.map((month) => {
        if (month.isFuture) return null;
        const monthAudits = completed.filter((audit) => audit.department === department && monthKeyOf(audit.date) === month.key);
        return monthAudits.length
          ? Math.round(monthAudits.reduce((sum, audit) => sum + (audit.totalScore || 0), 0) / monthAudits.length)
          : null;
      })
    }));
  }, [audits]);

  // Cumulative month-end closure rate: findings closed by month-end / findings raised by month-end.
  const monthlyClosureTrend = useMemo(() => {
    const departments = [...new Set(findings.map((f) => f.department))].sort();
    return departments.map((department) => ({
      department,
      values: YEAR_MONTHS.map((month) => {
        if (month.isFuture) return null;
        const raised = findings.filter((finding) =>
          finding.department === department && finding.createdAt && new Date(finding.createdAt) <= month.end
        );
        if (raised.length === 0) return null;
        const closed = raised.filter((finding) =>
          finding.status === "CLOSED" && finding.updatedAt && new Date(finding.updatedAt) <= month.end
        ).length;
        return Math.round((closed / raised.length) * 100);
      })
    }));
  }, [findings]);

  // Month-wise raised vs closed findings across the plant
  const monthlyRaisedVsClosed = useMemo(() => {
    return YEAR_MONTHS.map((month) => ({
      month: month.label,
      raised: month.isFuture ? null : findings.filter((finding) => monthKeyOf(finding.createdAt) === month.key).length,
      closed: month.isFuture ? null : findings.filter((finding) => finding.status === "CLOSED" && monthKeyOf(finding.updatedAt) === month.key).length
    }));
  }, [findings]);

  const recentAudits = useMemo(() => {
    return [...audits].sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime()).slice(0, 5);
  }, [audits]);

  const urgentFindings = useMemo(() => {
    return [...findings]
      .filter((f) => f.status !== "CLOSED" && (f.severity === "Critical" || f.severity === "High" || f.status === "OVERDUE"))
      .slice(0, 5);
  }, [findings]);

  const [exportingPdf, setExportingPdf] = useState(false);

  async function handleExportDashboardPdf() {
    setExportingPdf(true);
    try {
      const monthHeads = YEAR_MONTHS.map((month) => month.label.toUpperCase());
      const monthlyRowsWithTrend = (rows: Array<{ department: string; values: Array<number | null> }>, withTrend: boolean) =>
        rows.map((row) => [
          row.department,
          ...row.values.map((value, index) => {
            if (value === null) return "-";
            const delta = withTrend ? trendDelta(row.values, index) : null;
            return delta !== null ? `${value}% (${delta > 0 ? "+" : ""}${delta})` : `${value}%`;
          })
        ]);

      await downloadInsightsPdf({
        title: "Operations Dashboard",
        subtitle: `${COMPANY_NAME} — 6S Audit Control Centre`,
        fileName: `6S_Dashboard_Report_${new Date().toISOString().split("T")[0]}.pdf`,
        kpis: [
          { label: "Open Findings", value: stats.open },
          { label: "In Progress", value: stats.inProgress },
          { label: "Closed", value: stats.closed },
          { label: "Overdue", value: stats.overdue },
          { label: "Critical Active", value: stats.criticalActive },
          { label: "Pending Review", value: stats.pendingReview }
        ],
        sections: [
          {
            title: "Findings by Severity",
            head: ["Severity", "Count", "Share"],
            rows: [
              ...severityBreakdown.map((entry) => [
                entry.name,
                entry.value,
                `${findings.length ? Math.round((entry.value / findings.length) * 100) : 0}%`
              ]),
              ["Total", findings.length, "100%"]
            ]
          },
          {
            title: "Department Summary",
            head: ["Department", "Total", "Open", "Closed", "Delayed", "Score", "Status"],
            rows: departmentSummary.map((row) => [
              row.department,
              row.total,
              row.open,
              row.closed,
              row.delayed,
              `${row.auditScore}%`,
              row.compliant ? "Compliant" : "Non-Compliant"
            ])
          },
          {
            title: `Monthly Audit Score - ${DASHBOARD_YEAR}`,
            note: "Monthly average score by department",
            head: ["Department", ...monthHeads],
            rows: monthlyRowsWithTrend(monthlyAuditScore, false)
          },
          {
            title: `Monthly Closure Rate Trend - ${DASHBOARD_YEAR}`,
            note: "Closed till month-end / findings raised till month-end",
            head: ["Department", ...monthHeads],
            rows: monthlyRowsWithTrend(monthlyClosureTrend, true)
          },
          {
            title: `Monthly Findings Raised vs Closed - ${DASHBOARD_YEAR}`,
            head: ["Metric", ...monthHeads],
            rows: [
              ["Raised", ...monthlyRaisedVsClosed.map((month) => (month.raised === null ? "-" : month.raised))],
              ["Closed", ...monthlyRaisedVsClosed.map((month) => (month.closed === null ? "-" : month.closed))]
            ]
          }
        ]
      });
    } catch (error) {
      alert(error instanceof Error ? `Unable to create PDF: ${error.message}` : "Unable to create dashboard PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-t1">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-t2">{COMPANY_NAME} - 6S Audit Control Centre</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportDashboardPdf}
            disabled={exportingPdf || (auditsApi.loading && findingsApi.loading)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-3.5 py-2 text-sm font-medium text-t1 hover:bg-bg3 disabled:cursor-wait disabled:opacity-60"
          >
            <FileDown size={16} /> {exportingPdf ? "Creating PDF..." : "Export Dashboard PDF"}
          </button>
          <Link
            href="/audits"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d"
          >
            <Plus size={16} /> New 6S Audit
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <KpiCard label="Open Findings" value={stats.open} caption="Newly raised, not yet actioned" icon={FolderOpen} iconColor="#b91c1c" iconBg="#fee2e2" valueColor="#b91c1c" />
        <KpiCard label="In Progress" value={stats.inProgress} caption="CAPA underway" icon={Loader2} iconColor="#0284c7" iconBg="#e0f2fe" valueColor="#0284c7" />
        <KpiCard label="Closed" value={stats.closed} caption="Verified & resolved" icon={CheckCircle2} iconColor="#16a34a" iconBg="#f0fdf4" valueColor="#16a34a" />
        <KpiCard label="Overdue" value={stats.overdue} caption="Past target due date" icon={AlertTriangle} iconColor="#9a3412" iconBg="#ffedd5" valueColor="#9a3412" />
        <KpiCard label="Critical Active" value={stats.criticalActive} caption="Open critical severity" icon={ShieldAlert} iconColor="#dc2626" iconBg="#fee2e2" valueColor="#dc2626" />
        <KpiCard label="Pending Review" value={stats.pendingReview} caption="CAPA submitted, awaiting review" icon={Eye} iconColor="#6d28d9" iconBg="#f3e8ff" valueColor="#6d28d9" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Findings by Severity</h3>
          {severityBreakdown.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-t2">No findings recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Severity</th>
                    <th className={TH_RIGHT_CLASS}>Count</th>
                    <th className={TH_RIGHT_CLASS}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {severityBreakdown.map((entry) => (
                    <tr key={entry.name}>
                      <td className={`${TD_CLASS} font-semibold text-t1`}>
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: SEVERITY_COLORS[entry.name] || "#8896a5" }}
                        />
                        {entry.name}
                      </td>
                      <td className={`${TD_CLASS} text-right font-semibold`}>{entry.value}</td>
                      <td className={`${TD_CLASS} text-right text-t2`}>
                        {findings.length ? Math.round((entry.value / findings.length) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${TD_CLASS} font-extrabold text-t1`}>Total</td>
                    <td className={`${TD_CLASS} text-right font-extrabold text-t1`}>{findings.length}</td>
                    <td className={`${TD_CLASS} text-right font-extrabold text-t1`}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Department Summary</h3>
          {departmentSummary.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-t2">No department activity yet.</div>
          ) : (
            <div className="max-h-[260px] overflow-y-auto overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-t2">Dept</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Total</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Open</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Closed</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Delayed</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Score</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentSummary.map((row) => (
                    <tr key={row.department}>
                      <td className="border-b border-[#edf0f4] px-2 py-2 font-semibold text-t1">{row.department}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right">{row.total}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right text-red font-semibold">{row.open}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right text-green font-semibold">{row.closed}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right text-orange font-semibold">{row.delayed}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right font-semibold">{row.auditScore}%</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right">
                        <span
                          className={
                            row.compliant
                              ? "inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-extrabold text-green"
                              : "inline-flex items-center rounded-full border border-red-200 bg-accent px-2 py-0.5 text-[10px] font-extrabold text-brand-d"
                          }
                        >
                          {row.compliant ? "Compliant" : "Non-Compliant"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6">
        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-t1">Monthly Audit Score - {DASHBOARD_YEAR}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-t3">Monthly average score by department</span>
          </div>
          <MonthlyDepartmentTable rows={monthlyAuditScore} valueSuffix="%" emptyMessage="No completed audits yet." />
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-t1">Monthly Closure Rate Trend - {DASHBOARD_YEAR}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-t3">Closed till month-end / findings raised till month-end</span>
          </div>
          <MonthlyDepartmentTable rows={monthlyClosureTrend} valueSuffix="%" emptyMessage="No findings recorded yet." showTrend />
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Monthly Findings Raised vs Closed - {DASHBOARD_YEAR}</h3>
          <div className="overflow-x-auto rounded-lg border border-bd">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Metric</th>
                  {YEAR_MONTHS.map((month) => <th key={month.key} className={TH_RIGHT_CLASS}>{month.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${TD_CLASS} font-bold text-t1`}>Raised</td>
                  {monthlyRaisedVsClosed.map((month) => (
                    <td key={month.month} className={`${TD_CLASS} text-right font-semibold ${month.raised === null ? "text-t3" : "text-red"}`}>
                      {month.raised === null ? "-" : month.raised}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={`${TD_CLASS} font-bold text-t1`}>Closed</td>
                  {monthlyRaisedVsClosed.map((month) => (
                    <td key={month.month} className={`${TD_CLASS} text-right font-semibold ${month.closed === null ? "text-t3" : "text-green"}`}>
                      {month.closed === null ? "-" : month.closed}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AuditListCard audits={recentAudits} loading={auditsApi.loading} />
        <FindingListCard findings={urgentFindings} loading={findingsApi.loading} />
      </div>
    </>
  );
}
