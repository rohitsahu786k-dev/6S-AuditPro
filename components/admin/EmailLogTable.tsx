"use client";

import { useState } from "react";
import { apiPost, useApi } from "@/hooks/useApi";

type Log = { _id: string; templateKey?: string; triggerEvent?: string; recipients: string[]; subject?: string; status: string; errorMessage?: string; createdAt: string };

const STATUS_STYLES: Record<string, string> = {
  sent: "border-green-200 bg-green-50 text-green",
  failed: "border-red-200 bg-accent text-brand-d",
  skipped: "border-bd bg-bg3 text-t2"
};

export function EmailLogTable() {
  const logs = useApi<Log[]>("/api/email/logs");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (logId: string) => {
    setRetryingId(logId);
    try {
      const result = await apiPost<{ retried: boolean; status: string }>("/api/email/retry", { logId });
      alert(result.status === "sent" ? "Email resent successfully." : `Retry finished with status: ${result.status}`);
      logs.reload();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Email Logs</h1>
          <p className="mt-1 text-sm text-t2">Sent, failed, and skipped email delivery records.</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-bd bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">When</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Template</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Recipients</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Error</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.data?.map((l) => (
              <tr key={l._id}>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{l.templateKey || l.triggerEvent}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{l.recipients?.join(", ")}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${STATUS_STYLES[l.status] || STATUS_STYLES.skipped}`}>{l.status}</span>
                </td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{l.errorMessage}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                  {l.status === "failed" && (
                    <button
                      onClick={() => handleRetry(l._id)}
                      disabled={retryingId === l._id}
                      className="rounded-lg border border-bd bg-white px-2.5 py-1 text-xs font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-[.55]"
                    >
                      {retryingId === l._id ? "Retrying..." : "Retry"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
