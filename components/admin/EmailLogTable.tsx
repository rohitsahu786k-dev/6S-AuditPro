"use client";

import { useApi } from "@/hooks/useApi";

type Log = { _id: string; templateKey?: string; triggerEvent?: string; recipients: string[]; subject?: string; status: string; errorMessage?: string; createdAt: string };

export function EmailLogTable() {
  const logs = useApi<Log[]>("/api/email/logs");
  return (
    <>
      <div className="mb-[18px] flex items-end justify-between gap-4">
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
            </tr>
          </thead>
          <tbody>
            {logs.data?.map((l) => (
              <tr key={l._id}>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{l.templateKey || l.triggerEvent}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{l.recipients?.join(", ")}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-accent px-2.5 py-0.5 text-xs font-extrabold text-brand-d">{l.status}</span>
                </td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{l.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
