"use client";

import { useState } from "react";
import { apiPost, apiPatch, useApi } from "@/hooks/useApi";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

type QuestionRow = { _id: string; category: string; text: string; subSection?: string; sortOrder: number; status: string };
type Masters = { questions: QuestionRow[] };

export function QuestionManagementTable() {
  const masters = useApi<Masters>("/api/masters");
  const [form, setForm] = useState({ category: "1S", text: "", subSection: "", sortOrder: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ category: "1S", text: "", subSection: "", sortOrder: 0, status: "active" });
  const [message, setMessage] = useState("");

  const questions = masters.data?.questions || [];
  const categories = ["1S", "2S", "3S", "4S", "5S", "6S", "7S"];

  async function createQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!form.text.trim()) {
      alert("Question text is required.");
      return;
    }
    try {
      await apiPost("/api/masters/questions", form);
      setMessage("Question created successfully.");
      setForm({ category: "1S", text: "", subSection: "", sortOrder: 0 });
      await masters.reload();
    } catch (err: any) {
      alert(`Error creating question: ${err.message}`);
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      const res = await fetch(`/api/masters/questions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      setMessage("Question deleted.");
      await masters.reload();
    } catch (err: any) {
      alert(`Error deleting question: ${err.message}`);
    }
  }

  function startEdit(q: QuestionRow) {
    setEditingId(q._id);
    setEditForm({
      category: q.category,
      text: q.text,
      subSection: q.subSection || "",
      sortOrder: q.sortOrder || 0,
      status: q.status
    });
  }

  async function saveEdit(id: string) {
    try {
      await apiPatch(`/api/masters/questions/${id}`, editForm);
      setEditingId(null);
      setMessage("Question updated.");
      await masters.reload();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  }

  return (
    <div className="grid grid-2" style={{ gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
      {/* Create form */}
      <form className="card" onSubmit={createQuestion} style={{ alignSelf: "start" }}>
        <h2 className="card-title">Add 6S/7S Question</h2>
        {message && <div className="alert" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div>}
        
        <label className="field">
          <span className="label">Category / Pillar</span>
          <select 
            className="control" 
            value={form.category} 
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">Question Description</span>
          <textarea 
            className="control" 
            rows={3}
            placeholder="e.g. Are tools clean and stored in designated slots?" 
            value={form.text} 
            onChange={(e) => setForm({ ...form, text: e.target.value })} 
          />
        </label>

        <label className="field">
          <span className="label">Sub-Section (Optional)</span>
          <input 
            className="control" 
            placeholder="e.g. Tooling area, Floor storage" 
            value={form.subSection} 
            onChange={(e) => setForm({ ...form, subSection: e.target.value })} 
          />
        </label>

        <label className="field">
          <span className="label">Sort Order (Weight)</span>
          <input 
            type="number"
            className="control" 
            value={form.sortOrder} 
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} 
          />
        </label>

        <button className="btn primary" style={{ width: "100%", marginTop: "10px" }}>
          <Plus size={16} /> Add Question
        </button>
      </form>

      {/* List */}
      <div className="card">
        <h2 className="card-title">Configured Checklist Items</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Checklist Question</th>
                <th>Sub-Section</th>
                <th>Order</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q._id}>
                  {editingId === q._id ? (
                    <>
                      <td>
                        <select 
                          className="control" 
                          value={editForm.category} 
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <textarea 
                          className="control" 
                          rows={2}
                          value={editForm.text} 
                          onChange={(e) => setEditForm({ ...editForm, text: e.target.value })} 
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        />
                      </td>
                      <td>
                        <input 
                          className="control" 
                          value={editForm.subSection} 
                          onChange={(e) => setEditForm({ ...editForm, subSection: e.target.value })} 
                          style={{ padding: "4px 8px", fontSize: "13px" }}
                        />
                      </td>
                      <td>
                        <input 
                          type="number"
                          className="control" 
                          value={editForm.sortOrder} 
                          onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })} 
                          style={{ padding: "4px 8px", fontSize: "13px", width: "60px" }}
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
                        <button className="btn" onClick={() => saveEdit(q._id)} style={{ padding: "5px" }}>
                          <Check size={14} style={{ color: "green" }} />
                        </button>
                        <button className="btn" onClick={() => setEditingId(null)} style={{ padding: "5px" }}>
                          <X size={14} style={{ color: "red" }} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{q.category}</strong></td>
                      <td>{q.text}</td>
                      <td>{q.subSection || <span className="muted">—</span>}</td>
                      <td>{q.sortOrder}</td>
                      <td>
                        <span className={`badge ${q.status === "active" ? "" : "danger"}`} style={{ fontSize: "11px", padding: "1px 6px" }}>
                          {q.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button className="btn" onClick={() => startEdit(q)} style={{ padding: "4px 8px", fontSize: "12px" }}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn danger" onClick={() => deleteQuestion(q._id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
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
