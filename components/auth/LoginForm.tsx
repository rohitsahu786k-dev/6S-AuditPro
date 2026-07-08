"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { username, password, redirect: false });
      if (result?.error) {
        setError("Invalid username or password");
        return;
      }
      router.push(search.get("next") || "/dashboard");
      router.refresh();
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-[420px] rounded-2xl border border-bd bg-bg1 p-9 px-8 shadow-[var(--shadow-md)]"
    >
      <div className="mb-6 text-center">
        <img
          src="/onepws-dark-logo-scaled.png"
          alt={COMPANY_NAME}
          className="mx-auto mb-4 block w-[220px] max-w-[82%]"
        />
        <h1 className="mb-1 text-[22px] font-bold text-t1">{APP_NAME}</h1>
        <p className="text-[13px] text-t2">{COMPANY_NAME} — Enterprise Audit System</p>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2.5 text-[13px] text-red">
          {error}
        </div>
      ) : null}

      <div className="mb-3.5 grid gap-1.5">
        <Label htmlFor="l-user" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Username
        </Label>
        <Input
          id="l-user"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          className="h-auto rounded-[7px] border-bd px-3 py-2.5 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
          required
        />
      </div>

      <div className="mb-3.5 grid gap-1.5">
        <Label htmlFor="l-pass" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Password
        </Label>
        <div className="relative">
          <Input
            id="l-pass"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
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

      <label className="mb-4 flex items-center gap-2 text-[13px] text-t2">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="h-3.5 w-3.5 accent-brand"
        />
        Remember me
      </label>

      <Button
        type="submit"
        disabled={loading}
        className="h-auto w-full justify-center rounded-lg bg-brand px-[22px] py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(239,43,45,.22)] hover:bg-brand-d"
      >
        {loading ? "Signing in..." : "Login →"}
      </Button>
    </form>
  );
}
