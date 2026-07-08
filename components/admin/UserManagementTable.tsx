"use client";

import { useState } from "react";
import { apiPost, useApi } from "@/hooks/useApi";
import type { Role } from "@/types/domain";

type UserRow = { _id: string; name: string; username: string; email?: string; role: Role; department?: string; status: string; lastLoginAt?: string };

export function UserManagementTable() {
  const users = useApi<UserRow[]>("/api/users");
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "AUDITOR" as Role, department: "" });
  const [message, setMessage] = useState("");

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    await apiPost("/api/users", form);
    setMessage("User created.");
    setForm({ name: "", username: "", email: "", password: "", role: "AUDITOR", department: "" });
    await users.reload();
  }

  async function deactivate(id: string) {
    await apiPost(`/api/users/${id}/deactivate`);
    setMessage("User deactivated.");
    await users.reload();
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <form className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]" onSubmit={createUser}>
        <h2 className="mb-2.5 font-extrabold text-t1">Create User</h2>
        {message ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{message}</div> : null}
        <input className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Initial password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {["MASTER_ADMIN", "ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"].map((role) => <option key={role}>{role}</option>)}
        </select>
        <input className="mb-2 w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d">Create</button>
      </form>
      <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-2.5 font-extrabold text-t1">Users</h2>
        <div className="overflow-x-auto rounded-lg border border-bd bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Name</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Role</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2" />
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u._id}>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <strong>{u.name}</strong>
                    <br />
                    <span className="text-t2">@{u.username} {u.email}</span>
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{u.role}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{u.status}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <button className="inline-flex items-center gap-2 rounded-lg border border-red bg-red px-3.5 py-2.5 text-sm font-bold text-white" onClick={() => deactivate(u._id)}>Deactivate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
