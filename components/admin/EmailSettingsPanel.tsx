"use client";

import { useState } from "react";
import { apiPost } from "@/hooks/useApi";

export function EmailSettingsPanel() {
  const [message, setMessage] = useState("");
  async function test() {
    try {
      await apiPost("/api/email/settings/test");
      setMessage("SMTP connection verified.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SMTP test failed");
    }
  }
  return (
    <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
      <h1 className="text-2xl font-extrabold text-t1">Email Settings</h1>
      <p className="mt-1 mb-3 text-sm text-t2">SMTP values are read from server-side environment variables only. Passwords are never shown in the dashboard.</p>
      {message ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{message}</div> : null}
      <button
        className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d"
        onClick={test}
      >
        Test SMTP
      </button>
    </div>
  );
}
