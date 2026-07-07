"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { ClipboardCheck, TrendingUp, ListChecks, ShieldAlert, Activity, Plus, Sparkles } from "lucide-react";
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
};

export function DashboardClient() {
  const auditsApi = useApi<Audit[]>("/api/audits");
  const findingsApi = useApi<Finding[]>("/api/findings");

  const audits = auditsApi.data || [];
  const findings = findingsApi.data || [];

  const stats = useMemo(() => {
    const completed = audits.filter((a) => a.status === "COMPLETED");
    const avgScore = completed.length
      ? Math.round(completed.reduce((sum, a) => sum + (a.totalScore || 0), 0) / completed.length)
      : 0;

    const totalFindings = findings.length;
    const openFindings = findings.filter((f) => f.status !== "CLOSED").length;
    const closedFindings = findings.filter((f) => f.status === "CLOSED").length;
    const closureRate = totalFindings ? Math.round((closedFindings / totalFindings) * 100) : 0;

    const criticalOutstanding = findings.filter(
      (f) => f.status !== "CLOSED" && (f.severity === "Critical" || f.severity === "High")
    ).length;

    return {
      auditsCount: audits.length,
      avgScore,
      openFindings,
      closureRate,
      criticalOutstanding,
    };
  }, [audits, findings]);

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
          <h1 className="text-xl font-bold text-t1">Operations Command Center</h1>
          <p className="mt-1 text-sm text-t2">{COMPANY_NAME} — Industrial 6S / 7S Audit &amp; Safety Control Suite</p>
        </div>
        <Link
          href="/audits"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d"
        >
          <Plus size={16} /> New 6S Audit
        </Link>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-[10px] bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 text-white">
        <Sparkles size={250} className="pointer-events-none absolute -right-10 -bottom-10 text-white opacity-10" />
        <div className="relative z-10 max-w-[600px]">
          <h2 className="mb-2 flex items-center gap-2 text-[22px] font-semibold">
            6S Compliance &amp; Safety Hub <Sparkles size={18} className="text-[#fbbf24]" />
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-[#94a3b8]">
            Operational health is monitored in real time. Maintain high cleanliness, sorting accuracy, safety protocols, and
            execute Corrective and Preventive Actions (CAPA) before target deadlines.
          </p>
          <div className="flex gap-4 text-[13px]">
            <div>
              IMS Status: <span className="font-bold text-[#34d399]">● ACTIVE</span>
            </div>
            <div className="text-[#94a3b8]">|</div>
            <div>
              Latest Revision: <strong className="text-[#f3f4f6]">Rev.03</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <KpiCard
          label="Total Runs"
          value={stats.auditsCount}
          caption="Completed & draft audits"
          icon={ClipboardCheck}
          iconColor="#ef2b2d"
          iconBg="#f1f5f9"
        />
        <KpiCard
          label="Avg Compliance"
          value={`${stats.avgScore}%`}
          caption="Checklist score average"
          icon={TrendingUp}
          iconColor="#16a34a"
          iconBg="#f0fdf4"
          valueColor="#16a34a"
        />
        <KpiCard
          label="Open Findings"
          value={stats.openFindings}
          caption="Awaiting CAPA closure"
          icon={ListChecks}
          iconColor="#d97706"
          iconBg="#fffbeb"
          valueColor="#d97706"
        />
        <KpiCard
          label="Urgent Alerts"
          value={stats.criticalOutstanding}
          caption="Critical & High issues"
          icon={ShieldAlert}
          iconColor="#dc2626"
          iconBg="#fee2e2"
          valueColor="#dc2626"
        />
        <KpiCard
          label="Closure Rate"
          value={`${stats.closureRate}%`}
          caption="CAPAs verified & closed"
          icon={Activity}
          iconColor="#0284c7"
          iconBg="#e0f2fe"
          valueColor="#0284c7"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AuditListCard audits={recentAudits} loading={auditsApi.loading} />
        <FindingListCard findings={urgentFindings} loading={findingsApi.loading} />
      </div>
    </>
  );
}
