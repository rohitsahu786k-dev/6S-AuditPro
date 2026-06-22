"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/hooks/useApi";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/login", { username, password });
      router.push(search.get("next") || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-card">
      <img className="login-logo" src="/onepws-dark-logo-scaled.png" alt="ONEPWS Private Limited" />
      <h1 style={{ textAlign: "center", margin: "0 0 4px" }}>6S AuditPro</h1>
      <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>Enterprise audit system</p>
      {error ? <div className="alert">{error}</div> : null}
      <label className="field">
        <span className="label">Username</span>
        <input className="control" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input className="control" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
      </label>
      <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
        {loading ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
