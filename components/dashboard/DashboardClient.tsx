"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { FolderOpen, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Eye, Plus } from "lucide-react";
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

// CVD-validated categorical palette; departments keep their slot by first-seen order.
const DEPT_SERIES_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

const COMPLIANCE_TARGET = 90;

const TREND_MONTHS = 6;

function lastMonths(count: number) {
  const now = new Date();
  const months: Array<{ key: string; label: string }> = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en", { month: "short", year: "2-digit" })
    });
  }
  return months;
}

function monthKeyOf(isoDate?: string) {
  return isoDate ? isoDate.slice(0, 7) : "";
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
    const map = new Map<string, { total: number; open: number; inProcess: number; closed: number; scoreSum: number; scoreCount: number }>();
    for (const f of findings) {
      const row = map.get(f.department) || { total: 0, open: 0, inProcess: 0, closed: 0, scoreSum: 0, scoreCount: 0 };
      row.total += 1;
      if (f.status === "OPEN" || f.status === "REOPENED" || f.status === "OVERDUE" || f.status === "SUBMITTED") row.open += 1;
      if (f.status === "IN_PROGRESS") row.inProcess += 1;
      if (f.status === "CLOSED") row.closed += 1;
      map.set(f.department, row);
    }
    for (const a of audits) {
      if (a.status !== "COMPLETED") continue;
      const row = map.get(a.department) || { total: 0, open: 0, inProcess: 0, closed: 0, scoreSum: 0, scoreCount: 0 };
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
          auditScore,
          closurePct,
          compliant: auditScore >= COMPLIANCE_TARGET
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [findings, audits]);

  // Month-wise average audit score per department (issue: Monthly Audit Score)
  const monthlyAuditScore = useMemo(() => {
    const months = lastMonths(TREND_MONTHS);
    const completed = audits.filter((a) => a.status === "COMPLETED");
    const departments = [...new Set(completed.map((a) => a.department))].sort();
    const rows = months.map((m) => {
      const row: Record<string, string | number | null> = { month: m.label };
      for (const dept of departments) {
        const monthAudits = completed.filter((a) => a.department === dept && monthKeyOf(a.date) === m.key);
        row[dept] = monthAudits.length
          ? Math.round(monthAudits.reduce((sum, a) => sum + (a.totalScore || 0), 0) / monthAudits.length)
          : null;
      }
      return row;
    });
    return { rows, departments };
  }, [audits]);

  // Month-wise closed findings per department (issue: Monthly Closure Trend)
  const monthlyClosureTrend = useMemo(() => {
    const months = lastMonths(TREND_MONTHS);
    const closed = findings.filter((f) => f.status === "CLOSED");
    const departments = [...new Set(findings.map((f) => f.department))].sort();
    const rows = months.map((m) => {
      const row: Record<string, string | number> = { month: m.label };
      for (const dept of departments) {
        row[dept] = closed.filter((f) => f.department === dept && monthKeyOf(f.updatedAt) === m.key).length;
      }
      return row;
    });
    return { rows, departments };
  }, [findings]);

  // Month-wise raised vs closed findings across the plant
  const monthlyRaisedVsClosed = useMemo(() => {
    return lastMonths(TREND_MONTHS).map((m) => ({
      month: m.label,
      Raised: findings.filter((f) => monthKeyOf(f.createdAt) === m.key).length,
      Closed: findings.filter((f) => f.status === "CLOSED" && monthKeyOf(f.updatedAt) === m.key).length
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

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-t1">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-t2">{COMPANY_NAME} - 6S Audit Control Centre</p>
        </div>
        <Link
          href="/audits"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d"
        >
          <Plus size={16} /> New 6S Audit
        </Link>
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
            <div className="flex h-[260px] items-center justify-center text-sm text-t2">No findings recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 14, right: 48, bottom: 4, left: 48 }}>
                <Pie
                  data={severityBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="70%"
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                  fontSize={12}
                >
                  {severityBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "#8896a5"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
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

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Monthly Audit Score - Department Wise</h3>
          {monthlyAuditScore.departments.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-t2">No completed audits yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyAuditScore.rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {monthlyAuditScore.departments.map((dept, idx) => (
                  <Line
                    key={dept}
                    type="monotone"
                    dataKey={dept}
                    stroke={DEPT_SERIES_COLORS[idx % DEPT_SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-3 font-bold text-t1">Monthly Closure Trend - Department Wise</h3>
          {monthlyClosureTrend.departments.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-t2">No findings recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyClosureTrend.rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {monthlyClosureTrend.departments.map((dept, idx) => (
                  <Line
                    key={dept}
                    type="monotone"
                    dataKey={dept}
                    stroke={DEPT_SERIES_COLORS[idx % DEPT_SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)] lg:col-span-2">
          <h3 className="mb-3 font-bold text-t1">Monthly Findings Raised vs Closed</h3>
          {findings.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-t2">No findings recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyRaisedVsClosed} margin={{ top: 8, right: 12, bottom: 0, left: -16 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Raised" fill="#e34948" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Closed" fill="#008300" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AuditListCard audits={recentAudits} loading={auditsApi.loading} />
        <FindingListCard findings={urgentFindings} loading={findingsApi.loading} />
      </div>
    </>
  );
}
