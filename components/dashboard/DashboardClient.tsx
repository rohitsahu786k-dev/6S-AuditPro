"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, FileDown, FolderOpen, Loader2, Plus, ShieldAlert } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { downloadInsightsPdf } from "@/lib/insights-pdf";
import { auditMonthKey, departmentMonthKey, mergeAuditScoresByDepartmentMonth, scoreLabel } from "@/lib/audit-scoring";
import { COMPANY_NAME } from "@/lib/constants";
import { AuditListCard } from "@/components/dashboard/AuditListCard";
import { FindingListCard } from "@/components/dashboard/FindingListCard";
import { KpiCard } from "@/components/dashboard/KpiCard";

type Audit = {
  _id: string;
  auditNumber: string;
  auditType?: "STANDARD" | "ADHOC";
  department: string;
  zone: string;
  date: string;
  startDate?: string | null;
  endDate?: string | null;
  totalScore: number;
  adequateCount?: number;
  applicableCount?: number;
  departmentScores?: Array<{
    department: string;
    totalScore: number;
    adequateCount: number;
    applicableCount: number;
  }>;
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

type Masters = {
  departments: Array<{ name: string; isActive?: boolean }>;
};

type CurrentUser = { permissions: string[] };

type MonthlyRow = {
  department: string;
  values: Array<number | null>;
};

type DepartmentState = {
  total: number;
  open: number;
  inProcess: number;
  closed: number;
  delayed: number;
  latestAuditScore: number | null;
  latestAuditAt: number;
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#64748b"
};

const COMPLIANCE_TARGET = 90;
const DASHBOARD_YEAR = new Date().getFullYear();
const CURRENT_MONTH_INDEX = new Date().getMonth();
const TH_CLASS = "bg-bg3 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-t2";
const TH_RIGHT_CLASS = "bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2";
const TD_CLASS = "border-b border-[#edf0f4] px-2 py-2";

const YEAR_MONTHS = Array.from({ length: 12 }, (_, index) => ({
  key: `${DASHBOARD_YEAR}-${String(index + 1).padStart(2, "0")}`,
  label: new Date(DASHBOARD_YEAR, index, 1).toLocaleString("en", { month: "short" }),
  end: new Date(DASHBOARD_YEAR, index + 1, 0, 23, 59, 59, 999),
  isFuture: index > CURRENT_MONTH_INDEX
}));

function newDepartmentState(): DepartmentState {
  return {
    total: 0,
    open: 0,
    inProcess: 0,
    closed: 0,
    delayed: 0,
    latestAuditScore: null,
    latestAuditAt: -1
  };
}

function auditStartDate(audit: Audit) {
  return audit.startDate || audit.date || undefined;
}

function timestampOf(value?: string | null) {
  if (!value) return -1;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? -1 : timestamp;
}

function isFindingOverdue(finding: Finding) {
  if (finding.status === "CLOSED") return false;
  if (finding.status === "OVERDUE") return true;
  return Boolean(finding.dueDate && new Date(finding.dueDate) < new Date());
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function trendDelta(values: Array<number | null>, index: number): number | null {
  if (index === 0 || values[index] === null || values[index - 1] === null) return null;
  const delta = (values[index] as number) - (values[index - 1] as number);
  return delta === 0 ? null : delta;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function MonthlyDepartmentTable({
  rows,
  emptyMessage,
  showTrend = false
}: {
  rows: MonthlyRow[];
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
                    {value === null ? "-" : `${value}%`}
                    {delta !== null ? (
                      <span className={`ml-0.5 align-middle text-[9px] font-extrabold ${delta > 0 ? "text-green" : "text-red"}`}>
                        {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
                      </span>
                    ) : null}
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
  const auditsApi = useApi<Audit[]>("/api/audits?view=analytics");
  const findingsApi = useApi<Finding[]>("/api/findings?view=summary");
  const mastersApi = useApi<Masters>("/api/masters?view=lookup");
  const meApi = useApi<{ user: CurrentUser | null }>("/api/auth/me");

  const audits = auditsApi.data || [];
  const findings = findingsApi.data || [];
  const canCreateAudit = meApi.data?.user?.permissions.includes("audits:create") === true;
  const findingsLoading = findingsApi.loading && !findingsApi.data;

  useEffect(() => {
    const reloadDashboard = () => {
      if (document.visibilityState !== "visible") return;
      void Promise.all([auditsApi.reload(), findingsApi.reload()]);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reloadDashboard();
    };

    window.addEventListener("focus", reloadDashboard);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(reloadDashboard, 120_000);

    return () => {
      window.removeEventListener("focus", reloadDashboard);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [auditsApi.reload, findingsApi.reload]);

  const departments = useMemo(() => {
    const masterDepartments = (mastersApi.data?.departments || [])
      .filter((department) => department.isActive !== false)
      .map((department) => department.name);
    return uniqueSorted([
      ...masterDepartments,
      ...audits.map((audit) => audit.department),
      ...findings.map((finding) => finding.department)
    ]);
  }, [mastersApi.data, audits, findings]);

  const stats = useMemo(() => {
    const open = findings.filter((finding) => finding.status === "OPEN" || finding.status === "REOPENED").length;
    const inProgress = findings.filter((finding) => finding.status === "IN_PROGRESS").length;
    const closed = findings.filter((finding) => finding.status === "CLOSED").length;
    const overdue = findings.filter(isFindingOverdue).length;
    const criticalActive = findings.filter((finding) => finding.status !== "CLOSED" && finding.severity === "Critical").length;
    const pendingReview = findings.filter((finding) => finding.status === "SUBMITTED").length;
    return { open, inProgress, closed, overdue, criticalActive, pendingReview };
  }, [findings]);

  const severityBreakdown = useMemo(() => {
    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const finding of findings) counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => ({ name: severity, value: count }));
  }, [findings]);

  const completedAudits = useMemo(
    () => audits.filter((audit) => audit.status === "COMPLETED"),
    [audits]
  );

  const auditScoreRows = useMemo(
    () => completedAudits.flatMap((audit) => {
      const sourceDate = auditStartDate(audit);
      if (audit.departmentScores?.length) {
        return audit.departmentScores.map((score) => ({
          department: score.department,
          date: audit.date,
          startDate: sourceDate,
          totalScore: score.totalScore,
          adequateCount: score.adequateCount,
          applicableCount: score.applicableCount
        }));
      }
      return [{
        department: audit.department,
        date: audit.date,
        startDate: sourceDate,
        totalScore: audit.totalScore,
        adequateCount: audit.adequateCount,
        applicableCount: audit.applicableCount
      }];
    }),
    [completedAudits]
  );

  // One score per department per month: a department's standard and adhoc audits of
  // the same month are merged, so every table below reads from the same merged set.
  const mergedScores = useMemo(
    () => mergeAuditScoresByDepartmentMonth(auditScoreRows),
    [auditScoreRows]
  );

  const overallAuditRating = useMemo(() => {
    const groupScores = [...mergedScores.values()].map((group) => group.score);
    const score = groupScores.length
      ? Math.round(groupScores.reduce((sum, groupScore) => sum + groupScore, 0) / groupScores.length)
      : 0;
    return {
      auditCount: completedAudits.length,
      score,
      rating: scoreLabel(score),
      compliant: score >= COMPLIANCE_TARGET
    };
  }, [completedAudits, mergedScores]);

  const departmentSummary = useMemo(() => {
    const map = new Map<string, DepartmentState>();
    for (const department of departments) map.set(department, newDepartmentState());

    for (const finding of findings) {
      const row = map.get(finding.department) || newDepartmentState();
      row.total += 1;
      if (["OPEN", "REOPENED", "OVERDUE", "SUBMITTED"].includes(finding.status)) row.open += 1;
      if (finding.status === "IN_PROGRESS") row.inProcess += 1;
      if (finding.status === "CLOSED") row.closed += 1;
      if (isFindingOverdue(finding)) row.delayed += 1;
      map.set(finding.department, row);
    }

    // Latest score = merged score of the department's most recent audited month,
    // so a mid-month adhoc audit adds to that month instead of replacing it.
    for (const group of mergedScores.values()) {
      const row = map.get(group.department) || newDepartmentState();
      const monthAt = new Date(`${group.monthKey}-01T00:00:00`).getTime();
      if (row.latestAuditScore === null || monthAt > row.latestAuditAt) {
        row.latestAuditScore = group.score;
        row.latestAuditAt = monthAt;
      }
      map.set(group.department, row);
    }

    return [...map.entries()]
      .map(([department, row]) => ({
        department,
        total: row.total,
        open: row.open,
        inProcess: row.inProcess,
        closed: row.closed,
        delayed: row.delayed,
        auditScore: row.latestAuditScore,
        closurePct: row.total ? Math.round((row.closed / row.total) * 100) : 0,
        compliant: row.latestAuditScore !== null && row.latestAuditScore >= COMPLIANCE_TARGET
      }))
      .sort((left, right) => right.total - left.total || left.department.localeCompare(right.department));
  }, [departments, findings, mergedScores]);

  const monthlyAuditScore = useMemo<MonthlyRow[]>(() => {
    return departments.map((department) => ({
      department,
      values: YEAR_MONTHS.map((month) => {
        if (month.isFuture) return null;
        return mergedScores.get(departmentMonthKey(department, month.key))?.score ?? null;
      })
    }));
  }, [departments, mergedScores]);

  const monthlyClosureTrend = useMemo<MonthlyRow[]>(() => {
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
  }, [departments, findings]);

  const monthlyRaisedVsClosed = useMemo(() => {
    return YEAR_MONTHS.map((month) => ({
      month: month.label,
      raised: month.isFuture ? null : findings.filter((finding) => auditMonthKey(finding.createdAt) === month.key).length,
      closed: month.isFuture ? null : findings.filter((finding) => finding.status === "CLOSED" && auditMonthKey(finding.updatedAt) === month.key).length
    }));
  }, [findings]);

  const recentAudits = useMemo(
    () => [...completedAudits]
      .sort((left, right) => timestampOf(auditStartDate(right)) - timestampOf(auditStartDate(left)))
      .slice(0, 5),
    [completedAudits]
  );

  const urgentFindings = useMemo(
    () => findings
      .filter((finding) => finding.status !== "CLOSED" && (finding.severity === "Critical" || finding.severity === "High" || isFindingOverdue(finding)))
      .slice(0, 5),
    [findings]
  );

  const [exportingPdf, setExportingPdf] = useState(false);

  async function handleExportDashboardPdf() {
    setExportingPdf(true);
    try {
      const monthHeads = YEAR_MONTHS.map((month) => month.label.toUpperCase());
      const monthlyRows = (rows: MonthlyRow[], withTrend: boolean) => rows.map((row) => [
        row.department,
        ...row.values.map((value, index) => {
          if (value === null) return "-";
          const delta = withTrend ? trendDelta(row.values, index) : null;
          return delta === null ? `${value}%` : `${value}% (${delta > 0 ? "+" : ""}${delta})`;
        })
      ]);

      await downloadInsightsPdf({
        title: "Operations Dashboard",
        subtitle: `${COMPANY_NAME} - 6S Audit Control Centre`,
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
            title: "Overall 6S Rating - All Departments",
            head: ["Audits", "Rating", "Score", "Target", "Status"],
            rows: [[
              overallAuditRating.auditCount,
              `${overallAuditRating.rating.label} - ${overallAuditRating.rating.desc}`,
              `${overallAuditRating.score}%`,
              `>=${COMPLIANCE_TARGET}%`,
              overallAuditRating.compliant ? "Compliant" : "Below Target"
            ]]
          },
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
            head: ["Department", "Total", "Open", "Closed", "Delayed", "Latest Score", "Status"],
            rows: departmentSummary.map((row) => [
              row.department,
              row.total,
              row.open,
              row.closed,
              row.delayed,
              row.auditScore === null ? "-" : `${row.auditScore}%`,
              row.auditScore === null ? "No Audit" : row.compliant ? "Compliant" : "Non-Compliant"
            ])
          },
          {
            title: `Monthly Audit Score - ${DASHBOARD_YEAR}`,
            note: "Standard + Adhoc audits of a month merged into one score per department",
            head: ["Department", ...monthHeads],
            rows: monthlyRows(monthlyAuditScore, false)
          },
          {
            title: `Monthly Closure Rate Trend - ${DASHBOARD_YEAR}`,
            note: "Closed till month-end / findings raised till month-end",
            head: ["Department", ...monthHeads],
            rows: monthlyRows(monthlyClosureTrend, true)
          },
          {
            title: `Monthly Findings Raised vs Closed - ${DASHBOARD_YEAR}`,
            head: ["Metric", ...monthHeads],
            rows: [
              ["Raised", ...monthlyRaisedVsClosed.map((month) => month.raised === null ? "-" : month.raised)],
              ["Closed", ...monthlyRaisedVsClosed.map((month) => month.closed === null ? "-" : month.closed)]
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
          {canCreateAudit ? (
            <Link href="/audits" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d">
              <Plus size={16} /> New 6S Audit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <KpiCard label="Open Findings" value={findingsLoading ? "..." : stats.open} caption="Newly raised, not yet actioned" icon={FolderOpen} iconColor="#b91c1c" iconBg="#fee2e2" valueColor="#b91c1c" />
        <KpiCard label="In Progress" value={findingsLoading ? "..." : stats.inProgress} caption="CAPA underway" icon={Loader2} iconColor="#0284c7" iconBg="#e0f2fe" valueColor="#0284c7" />
        <KpiCard label="Closed" value={findingsLoading ? "..." : stats.closed} caption="Verified & resolved" icon={CheckCircle2} iconColor="#16a34a" iconBg="#f0fdf4" valueColor="#16a34a" />
        <KpiCard label="Overdue" value={findingsLoading ? "..." : stats.overdue} caption="Past target due date" icon={AlertTriangle} iconColor="#9a3412" iconBg="#ffedd5" valueColor="#9a3412" />
        <KpiCard label="Critical Active" value={findingsLoading ? "..." : stats.criticalActive} caption="Open critical severity" icon={ShieldAlert} iconColor="#dc2626" iconBg="#fee2e2" valueColor="#dc2626" />
        <KpiCard label="Pending Review" value={findingsLoading ? "..." : stats.pendingReview} caption="CAPA submitted, awaiting review" icon={Eye} iconColor="#6d28d9" iconBg="#f3e8ff" valueColor="#6d28d9" />
      </div>

      <div className="mb-6 overflow-hidden rounded-[10px] border border-bd bg-bg1 shadow-[var(--shadow-sm)]">
        <div className={`flex flex-col gap-4 border-l-4 p-4 sm:flex-row sm:items-center sm:justify-between ${overallAuditRating.compliant ? "border-green" : "border-brand-d"}`}>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Overall 6S Rating - All Departments</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${overallAuditRating.compliant ? "border-green-200 bg-green-50 text-green" : "border-orange-200 bg-orange-50 text-orange"}`}>
                {overallAuditRating.rating.label} - {overallAuditRating.rating.desc}
              </span>
              <span className={`text-2xl font-extrabold ${overallAuditRating.compliant ? "text-green" : "text-brand-d"}`}>{overallAuditRating.score}%</span>
            </div>
            <div className="mt-2 text-xs text-t2">
              Based on {overallAuditRating.auditCount} completed {overallAuditRating.auditCount === 1 ? "audit" : "audits"} | Target: &gt;={COMPLIANCE_TARGET}% for 6S compliance
            </div>
          </div>
          <div className="flex w-full items-end justify-start sm:w-auto sm:justify-end">
            <div className="relative h-20 w-32">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-16 rounded-t-full"
                style={{ background: `conic-gradient(from 270deg at 50% 100%, ${overallAuditRating.compliant ? "#22863a" : "#b91c1c"} 0deg ${clampPercent(overallAuditRating.score) * 1.8}deg, #e5e7eb ${clampPercent(overallAuditRating.score) * 1.8}deg 180deg, transparent 180deg 360deg)` }}
              />
              <div className="absolute inset-x-3 bottom-0 h-12 rounded-t-full bg-bg1" />
              <div className="absolute inset-x-0 bottom-1 text-center">
                <div className="text-sm font-extrabold text-t1">{overallAuditRating.rating.label}</div>
                <div className="text-[11px] font-bold text-t2">{overallAuditRating.score}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Findings by Severity</h3>
          {severityBreakdown.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-t2">No findings recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr><th className={TH_CLASS}>Severity</th><th className={TH_RIGHT_CLASS}>Count</th><th className={TH_RIGHT_CLASS}>Share</th></tr></thead>
                <tbody>
                  {severityBreakdown.map((entry) => (
                    <tr key={entry.name}>
                      <td className={`${TD_CLASS} font-semibold text-t1`}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SEVERITY_COLORS[entry.name] || "#8896a5" }} />{entry.name}</td>
                      <td className={`${TD_CLASS} text-right font-semibold`}>{entry.value}</td>
                      <td className={`${TD_CLASS} text-right text-t2`}>{findings.length ? Math.round((entry.value / findings.length) * 100) : 0}%</td>
                    </tr>
                  ))}
                  <tr><td className={`${TD_CLASS} font-extrabold text-t1`}>Total</td><td className={`${TD_CLASS} text-right font-extrabold text-t1`}>{findings.length}</td><td className={`${TD_CLASS} text-right font-extrabold text-t1`}>100%</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold text-t1">Department Summary</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-t3">Latest audited month - standard + adhoc merged</span>
          </div>
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
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Latest Score</th>
                    <th className="sticky top-0 bg-bg3 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentSummary.map((row) => (
                    <tr key={row.department}>
                      <td className="border-b border-[#edf0f4] px-2 py-2 font-semibold text-t1">{row.department}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right">{row.total}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right font-semibold text-red">{row.open}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right font-semibold text-green">{row.closed}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right font-semibold text-orange">{row.delayed}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right font-semibold">{row.auditScore === null ? "-" : `${row.auditScore}%`}</td>
                      <td className="border-b border-[#edf0f4] px-2 py-2 text-right">
                        <span className={row.auditScore === null ? "inline-flex items-center rounded-full border border-bd bg-bg3 px-2 py-0.5 text-[10px] font-extrabold text-t2" : row.compliant ? "inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-extrabold text-green" : "inline-flex items-center rounded-full border border-red-200 bg-accent px-2 py-0.5 text-[10px] font-extrabold text-brand-d"}>
                          {row.auditScore === null ? "No Audit" : row.compliant ? "Compliant" : "Non-Compliant"}
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
            <span className="text-[10px] font-semibold uppercase tracking-wide text-t3">Standard + adhoc audits of the month merged per department</span>
          </div>
          <MonthlyDepartmentTable rows={monthlyAuditScore} emptyMessage="No completed audits yet." />
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-t1">Monthly Closure Rate Trend - {DASHBOARD_YEAR}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-t3">Closed till month-end / findings raised till month-end</span>
          </div>
          <MonthlyDepartmentTable rows={monthlyClosureTrend} emptyMessage="No findings recorded yet." showTrend />
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Monthly Findings Raised vs Closed - {DASHBOARD_YEAR}</h3>
          <div className="overflow-x-auto rounded-lg border border-bd">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead><tr><th className={TH_CLASS}>Metric</th>{YEAR_MONTHS.map((month) => <th key={month.key} className={TH_RIGHT_CLASS}>{month.label}</th>)}</tr></thead>
              <tbody>
                <tr><td className={`${TD_CLASS} font-bold text-t1`}>Raised</td>{monthlyRaisedVsClosed.map((month) => <td key={month.month} className={`${TD_CLASS} text-right font-semibold ${month.raised === null ? "text-t3" : "text-red"}`}>{month.raised === null ? "-" : month.raised}</td>)}</tr>
                <tr><td className={`${TD_CLASS} font-bold text-t1`}>Closed</td>{monthlyRaisedVsClosed.map((month) => <td key={month.month} className={`${TD_CLASS} text-right font-semibold ${month.closed === null ? "text-t3" : "text-green"}`}>{month.closed === null ? "-" : month.closed}</td>)}</tr>
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
