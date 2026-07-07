"use client";

import { useState } from "react";
import { apiPost, apiPatch, useApi } from "@/hooks/useApi";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

type DeptRow = { _id: string; name: string; status: string };
type Masters = { departments: DeptRow[] };

export function DepartmentManagementTable() {
  const masters = useApi<Masters>("/api/masters");
  const [form, setForm] = useState({ name: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", status: "active" });
  const [message, setMessage] = useState("");

  const departments = masters.data?.departments || [];

  async function createDept(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      alert("Name is required.");
      return;
    }
    try {
      await apiPost("/api/masters/departments", form);
      setMessage("Department created successfully.");
      setForm({ name: "" });
      await masters.reload();
    } catch (err: any) {
      alert(`Error creating department: ${err.message}`);
    }
  }

  async function deleteDept(id: string) {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      const res = await fetch(`/api/masters/departments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      setMessage("Department deleted.");
      await masters.reload();
    } catch (err: any) {
      alert(`Error deleting department: ${err.message}`);
    }
  }

  function startEdit(dept: DeptRow) {
    setEditingId(dept._id);
    setEditForm({
      name: dept.name,
      status: dept.status
    });
  }

  async function saveEdit(id: string) {
    try {
      await apiPatch(`/api/masters/departments/${id}`, editForm);
      setEditingId(null);
      setMessage("Department updated.");
      await masters.reload();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  }

  return (
    <div className="grid grid-2" style={{ gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
      {/* Create form */}
      <form className="card" onSubmit={createDept} style={{ alignSelf: "start" }}>
        <h2 className="card-title">Add Department</h2>
        {message && <div className="alert" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div>}
        
        <label className="field">
          <span className="label">Department Name</span>
          <input 
            className="control" 
            placeholder="e.g. Quality Assurance" 
            value={form.name} 
            onChange={(e) => setForm({ name: e.target.value })} 
          />
        </label>

        <button className="btn primary" style={{ width: "100%", marginTop: "10px" }}>
          <Plus size={16} /> Add Department
        </button>
      </form>

      {/* List */}
      <div className="card">
        <h2 className="card-title">Configured Departments</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d._id}>
                  {editingId === d._id ? (
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
                          value={editForm.status} 
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "right", display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button className="btn" onClick={() => saveEdit(d._id)} style={{ padding: "5px" }}>
                          <Check size={14} style={{ color: "green" }} />
                        </button>
                        <button className="btn" onClick={() => setEditingId(null)} style={{ padding: "5px" }}>
                          <X size={14} style={{ color: "red" }} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{d.name}</strong></td>
                      <td>
                        <span className={`badge ${d.status === "active" ? "" : "danger"}`} style={{ fontSize: "11px", padding: "1px 6px" }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button className="btn" onClick={() => startEdit(d)} style={{ padding: "4px 8px", fontSize: "12px" }}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn danger" onClick={() => deleteDept(d._id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
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
