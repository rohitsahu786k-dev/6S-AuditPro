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
    <div className="grid grid-2">
      <form className="card" onSubmit={createUser}>
        <h2 className="card-title">Create User</h2>
        {message ? <div className="alert">{message}</div> : null}
        <input className="control" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginBottom: 8 }} />
        <input className="control" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={{ marginBottom: 8 }} />
        <input className="control" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ marginBottom: 8 }} />
        <input className="control" placeholder="Initial password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ marginBottom: 8 }} />
        <select className="control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} style={{ marginBottom: 8 }}>
          {["MASTER_ADMIN", "ADMIN", "AUDITOR", "STORES_SPOC", "PRODUCTION_SPOC", "MANAGEMENT"].map((role) => <option key={role}>{role}</option>)}
        </select>
        <input className="control" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} style={{ marginBottom: 8 }} />
        <button className="btn primary">Create</button>
      </form>
      <div className="card">
        <h2 className="card-title">Users</h2>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{users.data?.map((u) => <tr key={u._id}><td><strong>{u.name}</strong><br /><span className="muted">@{u.username} {u.email}</span></td><td>{u.role}</td><td>{u.status}</td><td><button className="btn danger" onClick={() => deactivate(u._id)}>Deactivate</button></td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}
