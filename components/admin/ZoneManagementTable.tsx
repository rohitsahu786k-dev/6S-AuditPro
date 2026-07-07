"use client";

import { useState } from "react";
import { apiPost, apiPatch, apiPost as apiDelete, useApi } from "@/hooks/useApi";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

type ZoneRow = { _id: string; name: string; department: string; location?: string; status: string };
type Masters = { zones: ZoneRow[]; departments: Array<{ _id: string; name: string }> };

export function ZoneManagementTable() {
  const masters = useApi<Masters>("/api/masters");
  const [form, setForm] = useState({ name: "", department: "", location: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", department: "", location: "", status: "active" });
  const [message, setMessage] = useState("");

  const zones = masters.data?.zones || [];
  const departments = masters.data?.departments || [];

  async function createZone(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.department) {
      alert("Name and Department are required.");
      return;
    }
    try {
      await apiPost("/api/masters/zones", form);
      setMessage("Zone created successfully.");
      setForm({ name: "", department: "", location: "" });
      await masters.reload();
    } catch (err: any) {
      alert(`Error creating zone: ${err.message}`);
    }
  }

  async function deleteZone(id: string) {
    if (!confirm("Are you sure you want to delete this zone?")) return;
    try {
      // Use fetch DELETE method directly
      const res = await fetch(`/api/masters/zones/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      setMessage("Zone deleted.");
      await masters.reload();
    } catch (err: any) {
      alert(`Error deleting zone: ${err.message}`);
    }
  }

  function startEdit(zone: ZoneRow) {
    setEditingId(zone._id);
    setEditForm({
      name: zone.name,
      department: zone.department,
      location: zone.location || "",
      status: zone.status
    });
  }

  async function saveEdit(id: string) {
    try {
      await apiPatch(`/api/masters/zones/${id}`, editForm);
      setEditingId(null);
      setMessage("Zone updated.");
      await masters.reload();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  }

  return (
    <div className="grid grid-2" style={{ gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
      {/* Create form */}
      <form className="card" onSubmit={createZone} style={{ alignSelf: "start" }}>
        <h2 className="card-title">Add Area / Zone</h2>
        {message && <div className="alert" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div>}
        
        <label className="field">
          <span className="label">Zone Name</span>
          <input 
            className="control" 
            placeholder="e.g. Production Line 3" 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
          />
        </label>

        <label className="field">
          <span className="label">Department</span>
          <select 
            className="control" 
            value={form.department} 
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            <option value="">Select Department</option>
            {departments.map((d) => (
              <option key={d._id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">Location / Building</span>
          <input 
            className="control" 
            placeholder="e.g. Plant A, First Floor" 
            value={form.location} 
            onChange={(e) => setForm({ ...form, location: e.target.value })} 
          />
        </label>

        <button className="btn primary" style={{ width: "100%", marginTop: "10px" }}>
          <Plus size={16} /> Add Zone
        </button>
      </form>

      {/* List */}
      <div className="card">
        <h2 className="card-title">Configured Zones</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zone Name</th>
                <th>Department</th>
                <th>Location</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z._id}>
                  {editingId === z._id ? (
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
                          value={editForm.department} 
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        >
                          {departments.map((d) => (
                            <option key={d._id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input 
                          className="control" 
                          value={editForm.location} 
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} 
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
                        <button className="btn" onClick={() => saveEdit(z._id)} style={{ padding: "5px" }}>
                          <Check size={14} style={{ color: "green" }} />
                        </button>
                        <button className="btn" onClick={() => setEditingId(null)} style={{ padding: "5px" }}>
                          <X size={14} style={{ color: "red" }} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{z.name}</strong></td>
                      <td>{z.department}</td>
                      <td>{z.location || <span className="muted">—</span>}</td>
                      <td>
                        <span className={`badge ${z.status === "active" ? "" : "danger"}`} style={{ fontSize: "11px", padding: "1px 6px" }}>
                          {z.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button className="btn" onClick={() => startEdit(z)} style={{ padding: "4px 8px", fontSize: "12px" }}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn danger" onClick={() => deleteZone(z._id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
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
