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
    <div className="grid grid-2" style={{ gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
      {/* Create form */}
      <form className="card" onSubmit={createPerson} style={{ alignSelf: "start" }}>
        <h2 className="card-title">Add Staff / Auditor</h2>
        {message && <div className="alert" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div>}
        
        <label className="field">
          <span className="label">Full Name</span>
          <input 
            className="control" 
            placeholder="e.g. John Doe" 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
          />
        </label>

        <label className="field">
          <span className="label">Role Type</span>
          <select 
            className="control" 
            value={form.type} 
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
          >
            <option value="AUDITOR">Auditor</option>
            <option value="RESPONSIBLE">Responsible (SPOC)</option>
          </select>
        </label>

        <label className="field">
          <span className="label">Department (If SPOC)</span>
          <select 
            className="control" 
            value={form.department} 
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            <option value="">N/A (Auditor/General)</option>
            {departments.map((d) => (
              <option key={d._id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </label>

        <button className="btn primary" style={{ width: "100%", marginTop: "10px" }}>
          <Plus size={16} /> Add Person
        </button>
      </form>

      {/* List */}
      <div className="card">
        <h2 className="card-title">Configured Personnel</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Role Type</th>
                <th>Department</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p._id}>
                  {editingId === p._id ? (
                    <>
                      <td>
                        <input 
                          className="control" 
                          value={editForm.name} 
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        />
                      </td>
                      <td>
                        <select 
                          className="control" 
                          value={editForm.type} 
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        >
                          <option value="AUDITOR">Auditor</option>
                          <option value="RESPONSIBLE">Responsible</option>
                        </select>
                      </td>
                      <td>
                        <select 
                          className="control" 
                          value={editForm.department} 
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        >
                          <option value="">N/A</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select 
                          className="control" 
                          value={editForm.status} 
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "right", display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button className="btn" onClick={() => saveEdit(p._id)} style={{ padding: "5px" }}>
                          <Check size={14} style={{ color: "green" }} />
                        </button>
                        <button className="btn" onClick={() => setEditingId(null)} style={{ padding: "5px" }}>
                          <X size={14} style={{ color: "red" }} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{p.name}</strong></td>
                      <td>
                        <span className={`badge ${p.type === "AUDITOR" ? "" : "warning"}`} style={{ fontSize: "11px", padding: "1px 6px" }}>
                          {p.type}
                        </span>
                      </td>
                      <td>{p.department || <span className="muted">All Departments</span>}</td>
                      <td>
                        <span className={`badge ${p.status === "active" ? "" : "danger"}`} style={{ fontSize: "11px", padding: "1px 6px" }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button className="btn" onClick={() => startEdit(p)} style={{ padding: "4px 8px", fontSize: "12px" }}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn danger" onClick={() => deletePerson(p._id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
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
