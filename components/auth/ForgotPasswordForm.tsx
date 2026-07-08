"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-bd bg-bg1 p-9 px-8 shadow-[var(--shadow-md)]">
      <div className="mb-6 text-center">
        <img
          src="/onepws-dark-logo-scaled.png"
          alt={COMPANY_NAME}
          className="mx-auto mb-4 block w-[220px] max-w-[82%]"
        />
        <h1 className="mb-1 text-[22px] font-bold text-t1">Reset your password</h1>
        <p className="text-[13px] text-t2">{APP_NAME} — {COMPANY_NAME}</p>
      </div>

      {sent ? (
        <div className="rounded-lg border border-[#86efac] bg-[#dcfce7] px-3 py-2.5 text-[13px] text-green">
          If an account exists for that email, a password reset link has been sent. Check your inbox.
        </div>
      ) : (
        <form onSubmit={submit}>
          {error ? (
            <div className="mb-3 rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2.5 text-[13px] text-red">
              {error}
            </div>
          ) : null}
          <p className="mb-3.5 text-[13px] text-t2">
            Enter the email linked to your account and we&apos;ll send you a link to reset your password.
          </p>
          <div className="mb-4 grid gap-1.5">
            <Label htmlFor="fp-email" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
              Email
            </Label>
            <Input
              id="fp-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="h-auto rounded-[7px] border-bd px-3 py-2.5 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-auto w-full justify-center rounded-lg bg-brand px-[22px] py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d"
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-[13px] text-t2">
        <Link href="/login" className="font-semibold text-brand hover:text-brand-d">
          Back to login
        </Link>
      </p>
    </div>
  );
}
