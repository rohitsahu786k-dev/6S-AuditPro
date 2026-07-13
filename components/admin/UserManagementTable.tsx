"use client";

import { useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { apiPost, useApi } from "@/hooks/useApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/types/domain";

type UserRow = {
  _id: string;
  name: string;
  username: string;
  email?: string;
  role: Role;
  department?: string;
  status: string;
  lastLoginAt?: string;
};

type Masters = {
  departments: Array<{ _id: string; name: string; isActive?: boolean }>;
};

const EMPTY_FORM = { name: "", username: "", email: "", password: "", role: "AUDITOR" as Role, department: "" };

export function UserManagementTable() {
  const users = useApi<UserRow[]>("/api/users");
  const masters = useApi<Masters>("/api/masters");
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  const departments = useMemo(
    () => (masters.data?.departments || []).filter((department) => department.isActive !== false),
    [masters.data]
  );

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiPost("/api/users", form);
      setMessage("User created successfully.");
      setForm(EMPTY_FORM);
      await users.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user.");
    }
  }

  async function deactivate(id: string) {
    if (!window.confirm("Deactivate this user account?")) return;
    setError("");
    try {
      await apiPost(`/api/users/${id}/deactivate`);
      setMessage("User deactivated.");
      await users.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deactivate user.");
    }
  }

  function closeResetDialog() {
    setResetUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetUser) return;
    setResetError("");
    if (newPassword.length < 8) {
      setResetError("Password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Password and confirmation do not match.");
      return;
    }

    setResetting(true);
    try {
      await apiPost(`/api/users/${resetUser._id}/change-password`, { newPassword });
      setMessage(`Password reset successfully for ${resetUser.name}.`);
      closeResetDialog();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(620px,1.4fr)]">
        <form className="h-fit rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]" onSubmit={createUser}>
          <h2 className="mb-2.5 font-extrabold text-t1">Create User</h2>
          {message ? <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-[13px] text-green">{message}</div> : null}
          {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{error}</div> : null}
          <input required className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input type="email" className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required minLength={8} className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Initial password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="mb-2 grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Role</span>
            <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(["MASTER_ADMIN", "ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"] as Role[]).map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <label className="mb-3 grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Department</span>
            <select
              className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              disabled={masters.loading}
            >
              <option value="">Not assigned / All departments</option>
              {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
            </select>
          </label>
          <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d">Create User</button>
        </form>

        <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-2.5 font-extrabold text-t1">Users</h2>
          <div className="overflow-x-auto rounded-lg border border-bd bg-white">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Name</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Role</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.loading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-t2">Loading users...</td></tr>
                ) : users.data?.map((user) => (
                  <tr key={user._id}>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                      <strong>{user.name}</strong><br />
                      <span className="text-t2">@{user.username}{user.email ? ` - ${user.email}` : ""}</span>
                    </td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{user.role.replace(/_/g, " ")}</td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{user.department || "All departments"}</td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{user.status}</td>
                    <td className="border-b border-[#edf0f4] px-3 py-2.5 text-right align-top">
                      <div className="inline-flex gap-1.5">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-2.5 py-1.5 text-xs font-bold text-t1 hover:bg-bg3"
                          onClick={() => setResetUser(user)}
                        >
                          <KeyRound size={13} /> Reset Password
                        </button>
                        {user.status === "active" ? (
                          <button className="rounded-lg border border-red bg-red px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-d" onClick={() => deactivate(user._id)}>Deactivate</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(resetUser)} onOpenChange={(open) => { if (!open) closeResetDialog(); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>Set a new temporary password for {resetUser?.name}. The user will receive a password-change confirmation email when email is configured.</DialogDescription>
          </DialogHeader>
          <form onSubmit={resetPassword} className="grid gap-4">
            {resetError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{resetError}</div> : null}
            <div className="grid gap-1.5">
              <Label htmlFor="admin-new-password">New Password</Label>
              <Input id="admin-new-password" type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-confirm-password">Confirm New Password</Label>
              <Input id="admin-confirm-password" type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeResetDialog}>Cancel</Button>
              <Button type="submit" disabled={resetting} className="bg-brand text-white hover:bg-brand-d">
                {resetting ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
