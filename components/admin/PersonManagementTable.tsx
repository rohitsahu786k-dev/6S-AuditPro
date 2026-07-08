"use client";

import { useState } from "react";
import { apiPost, apiPatch, useApi } from "@/hooks/useApi";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

type PersonRow = { _id: string; name: string; type: "AUDITOR" | "RESPONSIBLE"; department?: string; status: string };
type Masters = { people: PersonRow[]; departments: Array<{ _id: string; name: string }> };

export function PersonManagementTable() {
  const masters = useApi<Masters>("/api/masters");
  const [form, setForm] = useState({ name: "", type: "AUDITOR" as "AUDITOR" | "RESPONSIBLE", department: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "AUDITOR" as "AUDITOR" | "RESPONSIBLE", department: "", status: "active" });
  const [message, setMessage] = useState("");

  const people = masters.data?.people || [];
  const departments = masters.data?.departments || [];

  async function createPerson(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      alert("Name is required.");
      return;
    }
    try {
      await apiPost("/api/masters/people", form);
      setMessage("Person created successfully.");
      setForm({ name: "", type: "AUDITOR", department: "" });
      await masters.reload();
    } catch (err: any) {
      alert(`Error creating person: ${err.message}`);
    }
  }

  async function deletePerson(id: string) {
    if (!confirm("Are you sure you want to delete this person?")) return;
    try {
      const res = await fetch(`/api/masters/people/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      setMessage("Person deleted.");
      await masters.reload();
    } catch (err: any) {
      alert(`Error deleting person: ${err.message}`);
    }
  }

  function startEdit(p: PersonRow) {
    setEditingId(p._id);
    setEditForm({
      name: p.name,
      type: p.type,
      department: p.department || "",
      status: p.status
    });
  }

  async function saveEdit(id: string) {
    try {
      await apiPatch(`/api/masters/people/${id}`, editForm);
      setEditingId(null);
      setMessage("Person updated.");
      await masters.reload();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_2fr]">
      {/* Create form */}
      <form className="h-fit rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]" onSubmit={createPerson}>
        <h2 className="mb-2.5 font-extrabold text-t1">Add Staff / Auditor</h2>
        {message && <div className="mb-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 text-[13px] text-[#166534]">{message}</div>}

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Full Name</span>
          <input
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            placeholder="e.g. John Doe"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Role Type</span>
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
          >
            <option value="AUDITOR">Auditor</option>
            <option value="RESPONSIBLE">Responsible (SPOC)</option>
          </select>
        </label>

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Department (If SPOC)</span>
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            <option value="">N/A (Auditor/General)</option>
            {departments.map((d) => (
              <option key={d._id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </label>

        <button className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d">
          <Plus size={16} /> Add Person
        </button>
      </form>

      {/* List */}
      <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-2.5 font-extrabold text-t1">Configured Personnel</h2>
        <div className="overflow-x-auto rounded-lg border border-bd bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Full Name</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Role Type</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p._id}>
                  {editingId === p._id ? (
                    <>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <input
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <select
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                        >
                          <option value="AUDITOR">Auditor</option>
                          <option value="RESPONSIBLE">Responsible</option>
                        </select>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <select
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                        >
                          <option value="">N/A</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <select
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="flex justify-end gap-1 border-b border-[#edf0f4] px-3 py-2.5 text-right align-top">
                        <button className="rounded-lg border border-bd bg-white p-[5px] hover:bg-bg3" onClick={() => saveEdit(p._id)}>
                          <Check size={14} className="text-green" />
                        </button>
                        <button className="rounded-lg border border-bd bg-white p-[5px] hover:bg-bg3" onClick={() => setEditingId(null)}>
                          <X size={14} className="text-red" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top"><strong>{p.name}</strong></td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-accent px-2 py-0.5 text-[11px] font-extrabold text-brand-d">
                          {p.type}
                        </span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{p.department || <span className="text-t2">All Departments</span>}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-accent px-2 py-0.5 text-[11px] font-extrabold text-brand-d">
                          {p.status}
                        </span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 text-right align-top">
                        <div className="inline-flex gap-1.5">
                          <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-2 py-1 text-xs font-bold text-t1 hover:bg-bg3" onClick={() => startEdit(p)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="inline-flex items-center gap-2 rounded-lg border border-red bg-red px-2 py-1 text-xs font-bold text-white" onClick={() => deletePerson(p._id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
