"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { apiPost } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Password and confirmation do not match");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/api/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
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
        <h1 className="mb-1 text-[22px] font-bold text-t1">Set a new password</h1>
        <p className="text-[13px] text-t2">{APP_NAME} — {COMPANY_NAME}</p>
      </div>

      {!token ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2.5 text-[13px] text-red">
          This reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            forgot password
          </Link>{" "}
          page.
        </div>
      ) : success ? (
        <div className="rounded-lg border border-[#86efac] bg-[#dcfce7] px-3 py-2.5 text-[13px] text-green">
          Password updated. Redirecting you to login...
        </div>
      ) : (
        <form onSubmit={submit}>
          {error ? (
            <div className="mb-3 rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2.5 text-[13px] text-red">
              {error}
            </div>
          ) : null}
          <div className="mb-3.5 grid gap-1.5">
            <Label htmlFor="rp-pass" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="rp-pass"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="h-auto rounded-[7px] border-bd px-3 py-2.5 pr-11 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-t3 hover:text-t2"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="mb-4 grid gap-1.5">
            <Label htmlFor="rp-confirm" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
              Confirm New Password
            </Label>
            <Input
              id="rp-confirm"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="h-auto rounded-[7px] border-bd px-3 py-2.5 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-auto w-full justify-center rounded-lg bg-brand px-[22px] py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d"
          >
            {loading ? "Saving..." : "Reset password"}
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
