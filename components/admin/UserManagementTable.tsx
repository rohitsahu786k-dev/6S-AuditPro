"use client";

import { useMemo, useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import { apiPatch, apiPost, useApi } from "@/hooks/useApi";
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

type DepartmentRow = {
  _id: string;
  name: string;
  isActive?: boolean;
  managerEmails?: string[];
  hodEmails?: string[];
  managementEmails?: string[];
};

type Masters = {
  departments: DepartmentRow[];
};

const EMPTY_FORM = { name: "", username: "", email: "", password: "", role: "AUDITOR" as Role, department: "" };
const EMPTY_EDIT_FORM = { name: "", username: "", email: "", role: "AUDITOR" as Role, department: "", status: "active" };
const EMPTY_ESCALATION_FORM = { managerEmails: "", hodEmails: "", managementEmails: "" };

export function UserManagementTable() {
  const users = useApi<UserRow[]>("/api/users");
  const masters = useApi<Masters>("/api/masters");
  const [form, setForm] = useState(EMPTY_FORM);
  const [escalationForm, setEscalationForm] = useState(EMPTY_ESCALATION_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const departments = useMemo(
    () => (masters.data?.departments || []).filter((department) => department.isActive !== false),
    [masters.data]
  );

  const departmentMap = useMemo(
    () => new Map((masters.data?.departments || []).map((department) => [department.name, department])),
    [masters.data]
  );

  function setDepartment(name: string) {
    setForm((current) => ({ ...current, department: name }));
    const department = departmentMap.get(name);
    setEscalationForm({
      managerEmails: (department?.managerEmails || []).join(", "),
      hodEmails: (department?.hodEmails || []).join(", "),
      managementEmails: (department?.managementEmails || []).join(", ")
    });
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiPost("/api/users", form);

      const department = departmentMap.get(form.department);
      if (department) {
        await apiPatch(`/api/masters/departments/${department._id}`, escalationForm);
      }

      setMessage("User created and Manager / HOD / Management escalation email IDs saved successfully.");
      setForm(EMPTY_FORM);
      setEscalationForm(EMPTY_ESCALATION_FORM);
      await Promise.all([users.reload(), masters.reload()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user or save escalation email IDs.");
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

  function openEditDialog(user: UserRow) {
    setEditUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      email: user.email || "",
      role: user.role,
      department: user.department || "",
      status: user.status
    });
    setEditError("");
  }

  function closeEditDialog() {
    setEditUser(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditError("");
  }

  async function updateUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editUser) return;
    setEditError("");
    setMessage("");
    setSavingEdit(true);
    try {
      await apiPatch(`/api/users/${editUser._id}`, editForm);
      setMessage(`User details updated for ${editForm.name}.`);
      closeEditDialog();
      await users.reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSavingEdit(false);
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
      <div className="space-y-4">
        <form className="w-full rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]" onSubmit={createUser}>
          <div className="mb-3">
            <h2 className="font-extrabold text-t1">Create User</h2>
            <p className="mt-1 text-xs text-t2">Create the account and save the selected department&apos;s Manager, HOD and Management escalation email IDs in the same data block.</p>
          </div>

          {message ? <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-[13px] text-green">{message}</div> : null}
          {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{error}</div> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Name</span>
              <input required className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Username</span>
              <input required className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Email</span>
              <input type="email" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="user@onepws.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Initial Password</span>
              <input required minLength={8} className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Minimum 8 characters" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Role</span>
              <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {(["MASTER_ADMIN", "ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"] as Role[]).map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Department</span>
              <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={form.department} onChange={(e) => setDepartment(e.target.value)} disabled={masters.loading}>
                <option value="">Not assigned / All departments</option>
                {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-bd bg-bg3/60 p-3.5">
            <div className="mb-2">
              <div className="text-[12px] font-extrabold uppercase tracking-wide text-t1">Department Escalation Email IDs</div>
              <div className="mt-1 text-xs text-t2">Saved against the selected department and used for automatic overdue CAPA escalation. Separate multiple IDs with commas.</div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Manager Email IDs</span>
                <input className="w-full rounded-lg border border-bd bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12 disabled:bg-bg3 disabled:text-t3" placeholder="manager@onepws.com" value={escalationForm.managerEmails} onChange={(e) => setEscalationForm({ ...escalationForm, managerEmails: e.target.value })} disabled={!form.department} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">HOD Email IDs</span>
                <input className="w-full rounded-lg border border-bd bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12 disabled:bg-bg3 disabled:text-t3" placeholder="hod@onepws.com" value={escalationForm.hodEmails} onChange={(e) => setEscalationForm({ ...escalationForm, hodEmails: e.target.value })} disabled={!form.department} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Management Email IDs</span>
                <input className="w-full rounded-lg border border-bd bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12 disabled:bg-bg3 disabled:text-t3" placeholder="management@onepws.com" value={escalationForm.managementEmails} onChange={(e) => setEscalationForm({ ...escalationForm, managementEmails: e.target.value })} disabled={!form.department} />
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-d">Create User</button>
          </div>
        </form>

        <div className="w-full rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-2.5 font-extrabold text-t1">Users</h2>
          <div className="overflow-x-auto rounded-lg border border-bd bg-white">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Name</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Role</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Escalation Emails</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-t2">Loading users...</td></tr>
                ) : users.data?.map((user) => {
                  const department = user.department ? departmentMap.get(user.department) : undefined;
                  return (
                    <tr key={user._id}>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top"><strong>{user.name}</strong><br /><span className="text-t2">@{user.username}{user.email ? ` - ${user.email}` : ""}</span></td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{user.role.replace(/_/g, " ")}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{user.department || "All departments"}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-xs text-t2">
                        <div><strong className="text-t1">Manager:</strong> {(department?.managerEmails || []).join(", ") || "-"}</div>
                        <div className="mt-1"><strong className="text-t1">HOD:</strong> {(department?.hodEmails || []).join(", ") || "-"}</div>
                        <div className="mt-1"><strong className="text-t1">Management:</strong> {(department?.managementEmails || []).join(", ") || "-"}</div>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{user.status}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 text-right align-top">
                        <div className="inline-flex gap-1.5">
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-2.5 py-1.5 text-xs font-bold text-t1 hover:bg-bg3" onClick={() => openEditDialog(user)}><Pencil size={13} /> Edit</button>
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-2.5 py-1.5 text-xs font-bold text-t1 hover:bg-bg3" onClick={() => setResetUser(user)}><KeyRound size={13} /> Reset Password</button>
                          {user.status === "active" ? <button className="rounded-lg border border-red bg-red px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-d" onClick={() => deactivate(user._id)}>Deactivate</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            <div className="grid gap-1.5"><Label htmlFor="admin-new-password">New Password</Label><Input id="admin-new-password" type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div>
            <div className="grid gap-1.5"><Label htmlFor="admin-confirm-password">Confirm New Password</Label><Input id="admin-confirm-password" type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeResetDialog}>Cancel</Button><Button type="submit" disabled={resetting} className="bg-brand text-white hover:bg-brand-d">{resetting ? "Resetting..." : "Reset Password"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editUser)} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Edit User Login Details</DialogTitle><DialogDescription>Update the account details used for signing in and user assignment.</DialogDescription></DialogHeader>
          <form onSubmit={updateUser} className="grid gap-4">
            {editError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{editError}</div> : null}
            <div className="grid gap-1.5"><Label htmlFor="edit-user-name">Name</Label><Input id="edit-user-name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required minLength={2} /></div>
            <div className="grid gap-1.5"><Label htmlFor="edit-user-username">Username</Label><Input id="edit-user-username" value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} required minLength={3} /></div>
            <div className="grid gap-1.5"><Label htmlFor="edit-user-email">Email</Label><Input id="edit-user-email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-user-role">Role</Label>
              <select id="edit-user-role" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as Role })}>
                {(["MASTER_ADMIN", "ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"] as Role[]).map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-user-department">Department</Label>
              <select id="edit-user-department" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={editForm.department} onChange={(event) => setEditForm({ ...editForm, department: event.target.value })} disabled={masters.loading}>
                <option value="">Not assigned / All departments</option>
                {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-user-status">Status</Label>
              <select id="edit-user-status" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeEditDialog}>Cancel</Button><Button type="submit" disabled={savingEdit} className="bg-brand text-white hover:bg-brand-d">{savingEdit ? "Saving..." : "Save Changes"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
