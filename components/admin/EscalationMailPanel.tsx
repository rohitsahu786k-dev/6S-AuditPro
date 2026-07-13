"use client";

import { useMemo, useState } from "react";
import { apiPost, useApi } from "@/hooks/useApi";
import { AlertTriangle, CheckCircle, Clock, Mail, Send } from "lucide-react";
import { SEVERITY_BADGE_STYLES } from "@/lib/status-styles";
import type { Severity } from "@/types/domain";

type Finding = {
  _id: string;
  findingNumber: string;
  auditNumber?: string;
  zone: string;
  department: string;
  category: string;
  question: string;
  severity: Severity;
  status: string;
  dueDate?: string;
};

type Log = {
  _id: string;
  templateKey?: string;
  triggerEvent?: string;
  recipients: string[];
  subject?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
};

const LOG_STATUS_STYLES: Record<string, string> = {
  sent: "border-green-200 bg-green-50 text-green",
  failed: "border-red-200 bg-accent text-brand-d",
  skipped: "border-bd bg-bg3 text-t2"
};

export function EscalationMailPanel() {
  const findingsApi = useApi<Finding[]>("/api/findings?view=summary");
  const logsApi = useApi<Log[]>("/api/email/logs");

  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Findings that are (or will be flagged as) overdue and eligible for escalation
  const overdueFindings = useMemo(() => {
    const now = new Date();
    return (findingsApi.data || []).filter((f) => {
      if (f.status === "CLOSED") return false;
      if (f.status === "OVERDUE") return true;
      return Boolean(f.dueDate && new Date(f.dueDate) < now);
    });
  }, [findingsApi.data]);

  const escalationLogs = useMemo(() => {
    return (logsApi.data || []).filter((log) => log.triggerEvent === "FINDING_OVERDUE");
  }, [logsApi.data]);

  const sentCount = escalationLogs.filter((log) => log.status === "sent").length;
  const failedCount = escalationLogs.filter((log) => log.status === "failed").length;

  const handleSendEscalations = async () => {
    setIsSending(true);
    setMessage(null);
    try {
      const result = await apiPost<{ checked: number; notified: number }>("/api/email/escalation");
      setMessage({
        type: "success",
        text: result.checked === 0
          ? "No overdue findings pending escalation right now."
          : `Escalation run finished: ${result.notified} of ${result.checked} overdue finding(s) escalated by email.`
      });
      findingsApi.reload();
      logsApi.reload();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Escalation run failed." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Escalation Mail</h1>
          <p className="mt-1 text-sm text-t2">Overdue findings escalation - review pending overdue observations and send reminder emails to department SPOCs and admins.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-[.55]"
          onClick={handleSendEscalations}
          disabled={isSending}
        >
          <Send size={15} /> {isSending ? "Sending Escalations..." : "Send Escalation Mails Now"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]"
              : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
          }`}
        >
          {message.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />} {message.text}
        </div>
      )}

      {/* Escalation counters */}
      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="rounded-lg bg-[#fee2e2] p-2.5 text-[#b91c1c]">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase text-t2">Overdue Findings</div>
            <div className="text-xl font-bold text-[#b91c1c]">{findingsApi.loading ? "..." : overdueFindings.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="rounded-lg bg-[#f0fdf4] p-2.5 text-[#15803d]">
            <Mail size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase text-t2">Escalations Sent</div>
            <div className="text-xl font-bold text-[#15803d]">{logsApi.loading ? "..." : sentCount}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="rounded-lg bg-[#fffbeb] p-2.5 text-[#b45309]">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase text-t2">Failed Escalations</div>
            <div className="text-xl font-bold text-[#b45309]">{logsApi.loading ? "..." : failedCount}</div>
          </div>
        </div>
      </div>

      {/* Overdue findings pending escalation */}
      <div className="mb-5 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <h3 className="mb-2.5 font-extrabold text-t1">Overdue Findings Eligible for Escalation</h3>
        {findingsApi.loading ? (
          <div className="p-5 text-center text-t2">Loading findings...</div>
        ) : overdueFindings.length === 0 ? (
          <div className="p-5 text-center text-t2">No overdue findings right now. All CAPA actions are within their due dates.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-bd bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Finding ID</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department / Zone</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Severity</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Due Date</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Observation / Question</th>
                </tr>
              </thead>
              <tbody>
                {overdueFindings.map((f) => {
                  const severityStyle = SEVERITY_BADGE_STYLES[f.severity] ?? SEVERITY_BADGE_STYLES.Low;
                  return (
                    <tr key={f._id}>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top"><strong>{f.findingNumber}</strong></td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{f.department} / {f.zone}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold"
                          style={{ background: severityStyle.bg, color: severityStyle.text, borderColor: severityStyle.border }}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-red font-semibold">
                        {f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{f.status}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-xs">{f.question}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Escalation mail history */}
      <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <h3 className="mb-2.5 font-extrabold text-t1">Escalation Mail History</h3>
        {logsApi.loading ? (
          <div className="p-5 text-center text-t2">Loading escalation logs...</div>
        ) : escalationLogs.length === 0 ? (
          <div className="p-5 text-center text-t2">No escalation mails have been sent yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-bd bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Sent At</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Subject</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Recipients</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Error</th>
                </tr>
              </thead>
              <tbody>
                {escalationLogs.map((log) => (
                  <tr key={log._id}>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{log.subject || "—"}</td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-xs">{log.recipients.join(", ")}</td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${LOG_STATUS_STYLES[log.status] || LOG_STATUS_STYLES.skipped}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-xs text-red">{log.errorMessage || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
