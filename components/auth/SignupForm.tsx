"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { apiPost } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Password and confirmation do not match");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/api/auth/signup", { name, username, email, password });
      const result = await signIn("credentials", { username, password, redirect: false });
      if (result?.error) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
        <h1 className="mb-1 text-[22px] font-bold text-t1">Create your {APP_NAME} account</h1>
        <p className="text-[13px] text-t2">{COMPANY_NAME} — Enterprise Audit System</p>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2.5 text-[13px] text-red">
          {error}
        </div>
      ) : null}

      <div className="mb-3.5 grid gap-1.5">
        <Label htmlFor="s-name" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Full Name
        </Label>
        <Input
          id="s-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="h-auto rounded-[7px] border-bd px-3 py-2.5 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
          required
        />
      </div>

      <div className="mb-3.5 grid gap-1.5">
        <Label htmlFor="s-user" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Username
        </Label>
        <Input
          id="s-user"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          className="h-auto rounded-[7px] border-bd px-3 py-2.5 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
          required
        />
      </div>

      <div className="mb-3.5 grid gap-1.5">
        <Label htmlFor="s-email" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Email
        </Label>
        <Input
          id="s-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="h-auto rounded-[7px] border-bd px-3 py-2.5 text-sm focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/12"
          required
        />
      </div>

      <div className="mb-3.5 grid gap-1.5">
        <Label htmlFor="s-pass" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Password
        </Label>
        <div className="relative">
          <Input
            id="s-pass"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
        <Label htmlFor="s-confirm" className="text-[11px] font-bold uppercase tracking-[.5px] text-t2">
          Confirm Password
        </Label>
        <Input
          id="s-confirm"
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
        {loading ? "Creating account..." : "Create account →"}
      </Button>

      <p className="mt-4 text-center text-[13px] text-t2">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-d">
          Login
        </Link>
      </p>
    </form>
  );
}
