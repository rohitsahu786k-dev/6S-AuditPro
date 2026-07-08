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
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_2fr]">
      {/* Create form */}
      <form className="h-fit rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]" onSubmit={createQuestion}>
        <h2 className="mb-2.5 font-extrabold text-t1">Add 6S/7S Question</h2>
        {message && <div className="mb-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 text-[13px] text-[#166534]">{message}</div>}

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Category / Pillar</span>
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Question Description</span>
          <textarea
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            rows={3}
            placeholder="e.g. Are tools clean and stored in designated slots?"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
          />
        </label>

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Sub-Section (Optional)</span>
          <input
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            placeholder="e.g. Tooling area, Floor storage"
            value={form.subSection}
            onChange={(e) => setForm({ ...form, subSection: e.target.value })}
          />
        </label>

        <label className="mb-3 grid gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Sort Order (Weight)</span>
          <input
            type="number"
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
          />
        </label>

        <button className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d">
          <Plus size={16} /> Add Question
        </button>
      </form>

      {/* List */}
      <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-2.5 font-extrabold text-t1">Configured Checklist Items</h2>
        <div className="overflow-x-auto rounded-lg border border-bd bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Category</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Checklist Question</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Sub-Section</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Order</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q._id}>
                  {editingId === q._id ? (
                    <>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <select
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <textarea
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          rows={2}
                          value={editForm.text}
                          onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                        />
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <input
                          className="w-full rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.subSection}
                          onChange={(e) => setEditForm({ ...editForm, subSection: e.target.value })}
                        />
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <input
                          type="number"
                          className="w-[60px] rounded-lg border border-bd px-2 py-1 text-[13px] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                          value={editForm.sortOrder}
                          onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })}
                        />
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
                        <button className="rounded-lg border border-bd bg-white p-[5px] hover:bg-bg3" onClick={() => saveEdit(q._id)}>
                          <Check size={14} className="text-green" />
                        </button>
                        <button className="rounded-lg border border-bd bg-white p-[5px] hover:bg-bg3" onClick={() => setEditingId(null)}>
                          <X size={14} className="text-red" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top"><strong>{q.category}</strong></td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{q.text}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{q.subSection || <span className="text-t2">—</span>}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{q.sortOrder}</td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-accent px-2 py-0.5 text-[11px] font-extrabold text-brand-d">
                          {q.status}
                        </span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 text-right align-top">
                        <div className="inline-flex gap-1.5">
                          <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-2 py-1 text-xs font-bold text-t1 hover:bg-bg3" onClick={() => startEdit(q)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="inline-flex items-center gap-2 rounded-lg border border-red bg-red px-2 py-1 text-xs font-bold text-white" onClick={() => deleteQuestion(q._id)}>
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
