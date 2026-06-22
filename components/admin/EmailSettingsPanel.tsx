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
    <div className="card">
      <h1 className="page-title">Email Settings</h1>
      <p className="page-sub">SMTP values are read from server-side environment variables only. Passwords are never shown in the dashboard.</p>
      {message ? <div className="alert">{message}</div> : null}
      <button className="btn primary" onClick={test}>Test SMTP</button>
    </div>
  );
}
