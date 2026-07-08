"use client";

import { useEffect, useMemo, useState } from "react";
import { apiPost, apiPatch, apiUpload, useApi } from "@/hooks/useApi";
import {
  Search,
  AlertTriangle,
  Eye,
  UploadCloud,
  X,
  CheckCircle2,
  Clock,
  Check,
  AlertOctagon,
  Trash2,
  Plus,
  ExternalLink
} from "lucide-react";
import { processImageToWebP } from "@/utils/media";
import { SEVERITY_BADGE_STYLES, STATUS_BADGE_STYLES, badgeStyleToVars } from "@/lib/status-styles";

type Finding = {
  _id: string;
  findingNumber: string;
  auditId?: string;
  auditNumber?: string;
  zone: string;
  department: string;
  questionId: string;
  category: string;
  question: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  observation?: string;
  beforePhotos: Array<{ secureUrl: string; publicId: string }>;
  assignedTo?: string;
  dueDate?: string;
  status: "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED" | "REJECTED" | "REOPENED" | "OVERDUE";
  capaAction?: string;
  closureRemarks?: string;
  rejectionReason?: string;
  afterPhotos: Array<{ secureUrl: string; publicId: string }>;
  capaStatus?: string;
  auditorReviewStatus?: string;
  timeline: Array<{
    action: string;
    note?: string;
    by: string;
    byName: string;
    at: string;
  }>;
  createdAt: string;
};

type UploadedPhoto = { secureUrl: string; publicId: string };

type SessionUser = {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: "MASTER_ADMIN" | "ADMIN" | "AUDITOR" | "SPOC" | "MANAGEMENT";
  department?: string;
};

type Masters = {
  zones: Array<{ name: string; department: string }>; 
  questions: Array<{ _id: string; category: string; text: string; subSection: string }>;
  people: Array<{ _id: string; name: string; type: string; department?: string }>;
};

const PAGE_SIZE = 20;

function formatStatus(status?: string) {
  return status ? status.replace(/_/g, " ") : "UNKNOWN";
}

export function FindingsWorkspace() {
  const findingsApi = useApi<Finding[]>("/api/findings?view=summary");
  const meApi = useApi<{ user: SessionUser | null }>("/api/auth/me");
  const masters = useApi<Masters>("/api/masters");
  
  const user = meApi.data?.user;

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Selected Finding details modal
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  
  // CAPA submission form state
  const [capaAction, setCapaAction] = useState("");
  const [closureRemarks, setClosureRemarks] = useState("");
  const [afterPhotos, setAfterPhotos] = useState<Array<{ secureUrl: string; publicId: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingCapa, setIsSubmittingCapa] = useState(false);

  // Review form state
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // General Notification
  const [note, setNote] = useState("");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Edit fields (Auditors/Admins only)
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editSeverity, setEditSeverity] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  // Ad-hoc Finding form state
  const [isCreateFindingModalOpen, setIsCreateFindingModalOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState("Safety");
  const [createZone, setCreateZone] = useState("");
  const [createQuestion, setCreateQuestion] = useState("");
  const [createSeverity, setCreateSeverity] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [createObservation, setCreateObservation] = useState("");
  const [createAssignedTo, setCreateAssignedTo] = useState("");
  const [createDueDate, setCreateDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [createFindingPhotos, setCreateFindingPhotos] = useState<Array<{ secureUrl: string; publicId: string }>>([]);
  const [isCreatingFinding, setIsCreatingFinding] = useState(false);
  const [isUploadingCreatePhoto, setIsUploadingCreatePhoto] = useState(false);

  // Image size warnings
  const [compressionAlert, setCompressionAlert] = useState<{
    file: File;
    sizeMb: string;
    isCreateForm: boolean;
  } | null>(null);

  // Filtered Findings
  const filteredFindings = useMemo(() => {
    if (!findingsApi.data) return [];
    return findingsApi.data.filter((f) => {
      const matchSearch = 
        f.findingNumber.toLowerCase().includes(search.toLowerCase()) ||
        f.question.toLowerCase().includes(search.toLowerCase()) ||
        (f.observation && f.observation.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "ALL" || f.status === statusFilter;
      const matchSeverity = severityFilter === "ALL" || f.severity === severityFilter;
      const matchDept = deptFilter === "ALL" || f.department === deptFilter;

      return matchSearch && matchStatus && matchSeverity && matchDept;
    });
  }, [findingsApi.data, search, statusFilter, severityFilter, deptFilter]);

  // Unique departments for filter dropdown
  const uniqueDepts = useMemo(() => {
    if (!findingsApi.data) return [];
    const depts = new Set(findingsApi.data.map(f => f.department));
    return Array.from(depts);
  }, [findingsApi.data]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, severityFilter, deptFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE));
  const pageRows = filteredFindings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  // Check roles permissions
  const canSubmitCapa = useMemo(() => {
    if (!user) return false;
    if (user.role === "MASTER_ADMIN" || user.role === "ADMIN") return true;
    // SPOC (and any department-scoped role) may act when their department matches the finding's
    if (user.department && selectedFinding?.department === user.department) return true;
    return false;
  }, [user, selectedFinding]);

  const canReviewCapa = useMemo(() => {
    if (!user) return false;
    return ["MASTER_ADMIN", "ADMIN", "AUDITOR"].includes(user.role);
  }, [user]);

  function normalizeFinding(finding: Finding): Finding {
    return {
      ...finding,
      beforePhotos: finding.beforePhotos || [],
      afterPhotos: finding.afterPhotos || [],
      timeline: finding.timeline || []
    };
  }

  async function openDetails(finding: Finding) {
    const summaryFinding = normalizeFinding(finding);
    setSelectedFinding(summaryFinding);
    setCapaAction(summaryFinding.capaAction || "");
    setClosureRemarks(summaryFinding.closureRemarks || "");
    setAfterPhotos(summaryFinding.afterPhotos || []);
    setRemarks("");
    setRejectionReason("");
    setIsEditingMetadata(false);
    setEditSeverity(summaryFinding.severity);
    setEditDueDate(summaryFinding.dueDate ? new Date(summaryFinding.dueDate).toISOString().split("T")[0] : "");
    setEditAssignedTo(summaryFinding.assignedTo || summaryFinding.department || "");
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/findings/${finding._id}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load finding details");
      const fullFinding = normalizeFinding(json.data as Finding);
      setSelectedFinding(fullFinding);
      setCapaAction(fullFinding.capaAction || "");
      setClosureRemarks(fullFinding.closureRemarks || "");
      setAfterPhotos(fullFinding.afterPhotos || []);
      setEditSeverity(fullFinding.severity);
      setEditDueDate(fullFinding.dueDate ? new Date(fullFinding.dueDate).toISOString().split("T")[0] : "");
      setEditAssignedTo(fullFinding.assignedTo || fullFinding.department || "");
    } catch (err: any) {
      alert(`Unable to load finding details: ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    if (file.size > 3 * 1024 * 1024) {
      setCompressionAlert({
        file,
        sizeMb,
        isCreateForm: false
      });
      event.target.value = "";
      return;
    }

    await executeUpload(file);
    event.target.value = "";
  }

  async function handleCreatePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    if (file.size > 3 * 1024 * 1024) {
      setCompressionAlert({
        file,
        sizeMb,
        isCreateForm: true
      });
      event.target.value = "";
      return;
    }

    await executeCreateUpload(file);
    event.target.value = "";
  }

  async function executeUpload(file: File) {
    setIsUploading(true);
    try {
      const processed = await processImageToWebP(file);
      const formData = new FormData();
      formData.append("file", processed.file);
      formData.append("folderSuffix", "capa-photos");

      const result = await apiUpload<UploadedPhoto>("/api/upload", formData);
      setAfterPhotos(prev => [...prev, { secureUrl: result.secureUrl, publicId: result.publicId }]);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function executeCreateUpload(file: File) {
    setIsUploadingCreatePhoto(true);
    try {
      const processed = await processImageToWebP(file);
      const formData = new FormData();
      formData.append("file", processed.file);
      formData.append("folderSuffix", "audit-photos");

      const result = await apiUpload<UploadedPhoto>("/api/upload", formData);
      setCreateFindingPhotos(prev => [...prev, { secureUrl: result.secureUrl, publicId: result.publicId }]);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploadingCreatePhoto(false);
    }
  }

  async function handleDeleteFinding(findingId: string) {
    if (!window.confirm("Are you sure you want to delete this finding? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/findings/${findingId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Delete failed");
      }

      setNote("Finding deleted successfully.");
      await findingsApi.reload();
    } catch (err: any) {
      alert(`Error deleting finding: ${err.message}`);
    }
  }

  async function handleCreateFinding() {
    if (!createZone) {
      alert("Please select a target zone/area.");
      return;
    }
    if (!createQuestion.trim()) {
      alert("Please describe the non-conformity finding / question.");
      return;
    }

    const selectedZone = masters.data?.zones.find(z => z.name === createZone);
    if (!selectedZone) {
      alert("Invalid zone selected.");
      return;
    }

    setIsCreatingFinding(true);
    try {
      const response = await apiPost<Finding>("/api/findings", {
        zone: createZone,
        department: selectedZone.department,
        category: createCategory,
        question: createQuestion,
        severity: createSeverity,
        observation: createObservation,
        assignedTo: createAssignedTo || selectedZone.department,
        dueDate: createDueDate,
        beforePhotos: createFindingPhotos
      });

      setNote(`Successfully created finding ${response.findingNumber}.`);
      setIsCreateFindingModalOpen(false);
      // Reset form
      setCreateZone("");
      setCreateQuestion("");
      setCreateObservation("");
      setCreateAssignedTo("");
      setCreateFindingPhotos([]);
      
      await findingsApi.reload();
    } catch (err: any) {
      alert(`Failed to create finding: ${err.message}`);
    } finally {
      setIsCreatingFinding(false);
    }
  }

  function removeAfterPhoto(index: number) {
    setAfterPhotos(prev => {
      const list = [...prev];
      list.splice(index, 1);
      return list;
    });
  }

  function removeCreatePhoto(index: number) {
    setCreateFindingPhotos(prev => {
      const list = [...prev];
      list.splice(index, 1);
      return list;
    });
  }

  async function submitCapaForm() {
    if (!selectedFinding) return;
    if (capaAction.trim().length < 3) {
      alert("Please provide a valid CAPA description (min 3 characters).");
      return;
    }

    setIsSubmittingCapa(true);
    try {
      const updated = await apiPost<Finding>(`/api/findings/${selectedFinding._id}/capa`, {
        capaAction,
        closureRemarks,
        afterPhotos
      });
      setSelectedFinding(updated);
      setNote(`CAPA submitted successfully for ${updated.findingNumber}.`);
      await findingsApi.reload();
    } catch (err: any) {
      alert(`Error submitting CAPA: ${err.message}`);
    } finally {
      setIsSubmittingCapa(false);
    }
  }

  async function submitReview(decision: "approve" | "reject" | "reopen") {
    if (!selectedFinding) return;

    if (decision === "reject" && !rejectionReason.trim()) {
      alert("Please enter a rejection reason.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const updated = await apiPost<Finding>(`/api/findings/${selectedFinding._id}/review`, {
        decision,
        remarks: remarks || rejectionReason,
        rejectionReason: decision === "reject" ? rejectionReason : undefined
      });
      setSelectedFinding(updated);
      setNote(`Finding status updated to: ${updated.status}.`);
      await findingsApi.reload();
    } catch (err: any) {
      alert(`Error review: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  }

  async function saveMetadataEdits() {
    if (!selectedFinding) return;

    try {
      const updated = await apiPatch<Finding>(`/api/findings/${selectedFinding._id}`, {
        severity: editSeverity,
        dueDate: editDueDate ? new Date(editDueDate) : undefined,
        assignedTo: editAssignedTo
      });
      setSelectedFinding(updated);
      setIsEditingMetadata(false);
      setNote(`Finding metadata updated.`);
      await findingsApi.reload();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-[18px] flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Findings & CAPA Dashboard</h1>
          <p className="mt-1 text-sm text-t2">Track non-conformities, submit Corrective & Preventive Action plans (CAPA), and verify closures.</p>
        </div>
        {user && ["MASTER_ADMIN", "ADMIN", "AUDITOR"].includes(user.role) && (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d"
            onClick={() => setIsCreateFindingModalOpen(true)}
          >
            <Plus size={16} /> Create Ad-Hoc Finding
          </button>
        )}
      </div>

      {note && <div className="mb-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 text-[13px] text-[#166534]">{note}</div>}

      {/* Search and Filters Bar */}
      <div className="mb-5 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-t2" />
            <input
              type="text"
              placeholder="Search by ID, question, observation..."
              className="w-full rounded-lg border border-bd py-2.5 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="REOPENED">REOPENED</option>
            <option value="OVERDUE">OVERDUE</option>
          </select>

          <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="ALL">All Departments</option>
            {uniqueDepts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid Log */}
      <div className="rounded-lg border border-bd bg-bg1 p-0 shadow-[var(--shadow-sm)]">
        {findingsApi.loading ? (
          <div className="p-6 text-center text-t2">Loading findings...</div>
        ) : filteredFindings.length === 0 ? (
          <div className="p-6 text-center text-t2">No matching findings found.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Finding ID</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Audit No</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Observation Details</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department / Zone</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Severity</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Target Due Date</th>
                  <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                  <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((f) => {
                  const isOverdue = f.status === "OVERDUE" || (f.status !== "CLOSED" && f.dueDate && new Date(f.dueDate) < new Date());
                  return (
                    <tr
                      key={f._id}
                      className={isOverdue ? "bg-[#fff5f5]" : "bg-transparent"}
                    >
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm"><strong>{f.findingNumber}</strong></td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm"><span className="text-xs text-t2">{f.auditNumber || "Manual"}</span></td>
                      <td className="max-w-[250px] border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                        <div className="text-[13px] font-semibold">{f.question}</div>
                        {f.observation && (
                          <div className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-t2">
                            {f.observation}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                        <div>{f.department}</div>
                        <span className="text-[11px] text-t2">{f.zone}</span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold"
                          style={badgeStyleToVars(SEVERITY_BADGE_STYLES[f.severity])}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                        <div className={`flex items-center gap-[5px] ${isOverdue ? "text-red" : "text-inherit"}`}>
                          {isOverdue && <AlertOctagon size={14} />}
                          <span>{f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "No Date"}</span>
                        </div>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                        <span
                          className="inline-flex min-w-[86px] items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-extrabold"
                          style={badgeStyleToVars(STATUS_BADGE_STYLES[f.status] ?? STATUS_BADGE_STYLES.OPEN)}
                        >
                          {formatStatus(f.status)}
                        </span>
                      </td>
                      <td className="border-b border-[#edf0f4] px-3 py-2.5 text-right align-top text-sm">
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-2.5 py-[5px] text-xs font-bold text-t1 hover:bg-bg3"
                            onClick={() => { void openDetails(f); }}
                          >
                            <Eye size={12} /> Open
                          </button>
                          {user && ["MASTER_ADMIN", "ADMIN"].includes(user.role) && (
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-red bg-white px-2.5 py-[5px] text-xs font-bold text-red hover:bg-bg3"
                              onClick={() => handleDeleteFinding(f._id)}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!findingsApi.loading && filteredFindings.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-t2">
          <div>
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredFindings.length)} of {filteredFindings.length} findings
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center justify-center rounded-lg border border-bd bg-white px-3 py-1.5 text-sm font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              Prev
            </button>
            <span className="min-w-[82px] text-center text-xs font-semibold text-t2">
              Page {page} / {pageCount}
            </span>
            <button
              className="inline-flex items-center justify-center rounded-lg border border-bd bg-white px-3 py-1.5 text-sm font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* DETAIL MODAL PANEL */}
      {selectedFinding && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-5">
          <div className="relative w-full max-w-[850px] rounded-lg border border-bd bg-bg1 p-6 shadow-[var(--shadow-sm)] max-h-[92vh] overflow-y-auto">
            {/* Close */}
            <button
              onClick={() => setSelectedFinding(null)}
              className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-bd bg-white text-t2 shadow-[0_4px_14px_rgba(15,23,42,0.12)] hover:bg-bg3"
              aria-label="Close finding details"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-[18px] flex items-start justify-between gap-4 border-b border-bd pb-3.5 pr-12">
              <div>
                <span className="mb-1.5 inline-flex items-center rounded-full border border-red-200 bg-accent px-2.5 py-0.5 text-xs font-extrabold text-brand-d">CAPA WORKFLOW</span>
                <h3 className="m-0 text-xl">Finding: {selectedFinding.findingNumber}</h3>
                <span className="text-[13px] text-t2">
                  Spawned from Audit <strong>{selectedFinding.auditNumber || "Manual Setup"}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex min-w-[92px] items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-extrabold"
                  style={badgeStyleToVars(STATUS_BADGE_STYLES[selectedFinding.status] ?? STATUS_BADGE_STYLES.OPEN)}
                >
                  {formatStatus(selectedFinding.status)}
                </span>
              </div>
            </div>

            {/* Body Columns */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_1fr]">
              {isLoadingDetails ? (
                <div className="md:col-span-2 rounded-md border border-bd bg-bg3 px-3 py-2 text-sm text-t2">
                  Loading complete finding details...
                </div>
              ) : null}
              {/* Left Column: Context, Issue Details & Timeline */}
              <div>
                <div className="grid gap-3.5">
                  <div>
                    <h4 className="mb-1 text-[11px] uppercase tracking-wide text-t2">Question Context</h4>
                    <div className="text-sm font-bold">{selectedFinding.question}</div>
                  </div>

                  <div>
                    <h4 className="mb-1 text-[11px] uppercase tracking-wide text-t2">Observation</h4>
                    <p className="m-0 rounded-md border border-bd bg-[#f8fafc] p-2.5 text-[13px]">
                      {selectedFinding.observation || "No custom observations logged."}
                    </p>
                  </div>

                  {/* Before Photos */}
                  {selectedFinding.beforePhotos && selectedFinding.beforePhotos.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-[11px] uppercase tracking-wide text-t2">Audit Evidence (Before Photos)</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedFinding.beforePhotos.map((photo) => (
                          <a href={photo.secureUrl} target="_blank" rel="noopener noreferrer" key={photo.publicId}>
                            <img
                              src={photo.secureUrl}
                              alt="Before"
                              className="h-[70px] w-[70px] rounded-md border border-bd object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata Info (Auditor updates available if authorized) */}
                  <div className="rounded-lg border border-bd bg-[#f8fafc] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <strong className="text-[13px]">Action Metadata</strong>
                      {canReviewCapa && !isEditingMetadata && (
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-2 py-[3px] text-[11px] font-bold text-t1 hover:bg-bg3"
                          onClick={() => setIsEditingMetadata(true)}
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditingMetadata ? (
                      <div className="grid gap-2.5">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Severity</span>
                          <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as any)}>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Target Due Date</span>
                          <input type="date" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Assigned Responsbility</span>
                          <input type="text" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)} />
                        </label>
                        <div className="mt-[5px] flex justify-end gap-1.5">
                          <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-2 py-1 text-xs font-bold text-t1 hover:bg-bg3" onClick={() => setIsEditingMetadata(false)}>Cancel</button>
                          <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-2 py-1 text-xs font-bold text-white hover:bg-brand-d" onClick={saveMetadataEdits}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Zone: <strong>{selectedFinding.zone}</strong></div>
                        <div>Dept: <strong>{selectedFinding.department}</strong></div>
                        <div>Severity: <strong>{selectedFinding.severity}</strong></div>
                        <div>Due Date: <strong>{selectedFinding.dueDate ? new Date(selectedFinding.dueDate).toLocaleDateString() : "No Date"}</strong></div>
                        <div className="col-span-2">Assigned To: <strong>{selectedFinding.assignedTo || selectedFinding.department}</strong></div>
                      </div>
                    )}
                  </div>

                  {/* Timeline History */}
                  <div>
                    <h4 className="mb-2 text-[11px] uppercase tracking-wide text-t2">Audit Trail History</h4>
                    <div className="ml-1.5 grid gap-2.5 border-l-2 border-bd pl-3">
                      {selectedFinding.timeline.map((step, idx) => (
                        <div key={idx} className="relative text-xs">
                          <div className="absolute -left-[19px] top-[3px] h-3 w-3 rounded-full border-2 border-white bg-brand" />
                          <div className="font-semibold">{step.action}</div>
                          <div className="text-[11px] text-t2">by {step.byName} on {new Date(step.at || selectedFinding.createdAt).toLocaleString()}</div>
                          {step.note && <div className="mt-0.5 italic text-t2">"{step.note}"</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: CAPA Submission / Approval Review controls */}
              <div className="border-l border-bd pl-5">
                {/* 1. CLOSED FINDING DISPLAY */}
                {selectedFinding.status === "CLOSED" && (
                  <div className="grid gap-3.5">
                    <div className="flex items-center gap-2 font-bold text-green">
                      <CheckCircle2 size={20} /> CAPA Closed & Approved
                    </div>
                    <div>
                      <h4 className="mb-1 text-[11px] uppercase tracking-wide text-t2">Corrective Actions Executed</h4>
                      <p className="m-0 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-2.5 text-[13px]">
                        {selectedFinding.capaAction}
                      </p>
                    </div>
                    {selectedFinding.closureRemarks && (
                      <div>
                        <h4 className="mb-1 text-[11px] uppercase tracking-wide text-t2">Auditor Verification Notes</h4>
                        <p className="m-0 text-xs text-t2">"{selectedFinding.closureRemarks}"</p>
                      </div>
                    )}
                    {selectedFinding.afterPhotos && selectedFinding.afterPhotos.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-[11px] uppercase tracking-wide text-t2">Closure Proof (After Photos)</h4>
                        <div className="flex gap-1.5">
                          {selectedFinding.afterPhotos.map((p) => (
                            <a href={p.secureUrl} target="_blank" rel="noopener noreferrer" key={p.publicId}>
                              <img src={p.secureUrl} className="h-[60px] w-[60px] rounded border border-bd object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. REJECTED / REOPENED CAPA SUBMIT FORM */}
                {(selectedFinding.status === "OPEN" || selectedFinding.status === "REJECTED" || selectedFinding.status === "REOPENED" || selectedFinding.status === "OVERDUE") && (
                  <div>
                    {canSubmitCapa ? (
                      <div className="grid gap-3.5">
                        <div className="flex items-center gap-1.5 text-sm font-bold">
                          <Clock size={16} className="text-t2" /> Submit CAPA Resolution
                        </div>

                        {selectedFinding.status === "REJECTED" && (
                          <div className="rounded-md border border-[#fecaca] bg-[#fff5f5] p-2.5 text-xs text-red">
                            <strong>Rejection Note:</strong> "{selectedFinding.rejectionReason}"
                          </div>
                        )}

                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Corrective & Preventive Action Plan</span>
                          <textarea
                            rows={3}
                            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                            placeholder="Describe the exact actions taken to resolve the non-conformity..."
                            value={capaAction}
                            onChange={(e) => setCapaAction(e.target.value)}
                          />
                        </label>

                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Closure Remarks (Optional)</span>
                          <input
                            type="text"
                            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                            placeholder="Additional closure notes..."
                            value={closureRemarks}
                            onChange={(e) => setClosureRemarks(e.target.value)}
                          />
                        </label>

                        <div className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Upload Resolution Proof (After Photos)</span>
                          <div className="flex items-center gap-2.5">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-bd bg-white px-3 py-1.5 text-xs font-bold text-t1 hover:bg-bg3">
                              <UploadCloud size={14} /> {isUploading ? "Uploading..." : "Upload Photo"}
                              <input type="file" className="hidden" disabled={isUploading} onChange={handlePhotoUpload} />
                            </label>
                          </div>
                        </div>

                        {afterPhotos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {afterPhotos.map((p, pIdx) => (
                              <div key={p.publicId} className="relative h-[60px] w-[60px] overflow-hidden rounded border border-bd">
                                <img src={p.secureUrl} className="h-full w-full object-cover" />
                                <button
                                  onClick={() => removeAfterPhoto(pIdx)}
                                  className="absolute right-px top-px h-3.5 w-3.5 rounded-full border-none bg-red p-0 text-[8px] text-white"
                                >
                                  X
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={isSubmittingCapa || !capaAction.trim()}
                          onClick={submitCapaForm}
                        >
                          {isSubmittingCapa ? "Submitting..." : "Submit CAPA"}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-md bg-bg3 p-3 text-[13px] text-t2">
                        Waiting for CAPA submission from the department SPOC (<strong>{selectedFinding.department}</strong>).
                      </div>
                    )}
                  </div>
                )}

                {/* 3. CAPA SUBMITTED REVIEW WORKFLOW */}
                {selectedFinding.status === "SUBMITTED" && (
                  <div className="grid gap-3.5">
                    <div className="rounded-md border border-[#bae6fd] bg-[#f0f9ff] p-2.5">
                      <div className="mb-1 text-xs font-bold text-[#0369a1]">Pending Auditor Verification</div>
                      <div className="text-[13px] italic">"{selectedFinding.capaAction}"</div>

                      {selectedFinding.afterPhotos && selectedFinding.afterPhotos.length > 0 && (
                        <div className="mt-2 flex gap-1.5">
                          {selectedFinding.afterPhotos.map((p) => (
                            <a href={p.secureUrl} target="_blank" rel="noopener noreferrer" key={p.publicId}>
                              <img src={p.secureUrl} className="h-[50px] w-[50px] rounded object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {canReviewCapa ? (
                      <div className="grid gap-2.5">
                        <strong className="text-[13px]">Auditor Action Panel</strong>

                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Verification / Rejection Comments</span>
                          <textarea
                            rows={2}
                            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                            placeholder="Provide audit signoff notes or rejection remarks..."
                            value={remarks}
                            onChange={(e) => {
                              setRemarks(e.target.value);
                              setRejectionReason(e.target.value);
                            }}
                          />
                        </label>

                        <div className="flex gap-1.5">
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-green bg-green px-2 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
                            disabled={isSubmittingReview}
                            onClick={() => submitReview("approve")}
                          >
                            <Check size={14} /> Approve Closure
                          </button>
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-red bg-red px-2 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
                            disabled={isSubmittingReview || !rejectionReason.trim()}
                            onClick={() => submitReview("reject")}
                          >
                            <X size={14} /> Reject CAPA
                          </button>
                        </div>
                        <button
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-bd bg-white px-2 py-1.5 text-xs font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={isSubmittingReview}
                          onClick={() => submitReview("reopen")}
                        >
                          Reopen Finding
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-md bg-bg3 p-3 text-[13px] text-t2">
                        Waiting for auditor to verify and sign off closure.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom */}
            <div className="mt-5 flex justify-end border-t border-bd pt-3.5">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
                onClick={() => setSelectedFinding(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE AD-HOC FINDING MODAL */}
      {isCreateFindingModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
          <div className="relative w-full max-w-[600px] rounded-lg border border-bd bg-bg1 p-6 shadow-[var(--shadow-sm)] max-h-[92vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => setIsCreateFindingModalOpen(false)}
              className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-bd bg-white text-t2 shadow-[0_4px_14px_rgba(15,23,42,0.12)] hover:bg-bg3"
              aria-label="Close create finding"
            >
              <X size={20} />
            </button>

            <h3 className="mb-1 pr-12 text-xl font-extrabold">Create Ad-Hoc Finding</h3>
            <p className="mb-5 pr-12 text-[13px] text-t2">Log a new non-conformity finding directly to the database without a formal full-site audit.</p>

            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-semibold">Pillar / Category</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                  >
                    <option value="Sort">Sort (Seiri)</option>
                    <option value="Set in Order">Set in Order (Seiton)</option>
                    <option value="Shine">Shine (Seiso)</option>
                    <option value="Standardize">Standardize (Seiketsu)</option>
                    <option value="Sustain">Sustain (Shitsuke)</option>
                    <option value="Safety">Safety (Security)</option>
                    <option value="Environment">Environment</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-semibold">Zone / Area</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={createZone}
                    onChange={(e) => setCreateZone(e.target.value)}
                  >
                    <option value="">Select Zone...</option>
                    {masters.data?.zones.map((z) => (
                      <option key={z.name} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {createZone && (
                <div className="rounded-md border border-bd bg-[#f8fafc] px-3 py-2.5 text-[13px]">
                  <strong>Auto-detected Department: </strong>
                  <span className="font-semibold text-brand-d">
                    {masters.data?.zones.find(z => z.name === createZone)?.department || "N/A"}
                  </span>
                </div>
              )}

              <label>
                <span className="mb-1.5 block text-xs font-semibold">Non-Conformity Description *</span>
                <textarea
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  rows={3}
                  placeholder="Describe the issue or condition found..."
                  value={createQuestion}
                  onChange={(e) => setCreateQuestion(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-semibold">Severity Level</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={createSeverity}
                    onChange={(e) => setCreateSeverity(e.target.value as any)}
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-semibold">Target Due Date</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label>
                  <span className="mb-1.5 block text-xs font-semibold">Assignee (SPOC / Person Responsible)</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={createAssignedTo}
                    onChange={(e) => setCreateAssignedTo(e.target.value)}
                  >
                    <option value="">Select Assignee...</option>
                    {masters.data?.people.map((p) => (
                      <option key={p.name} value={p.name}>{p.name} ({p.department || "All"})</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span className="mb-1.5 block text-xs font-semibold">Additional Observation / Details</span>
                <textarea
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  rows={2}
                  placeholder="Optional details, context, or notes..."
                  value={createObservation}
                  onChange={(e) => setCreateObservation(e.target.value)}
                />
              </label>

              <div>
                <span className="mb-2 block text-xs font-semibold">Evidence Photos (Before)</span>

                <div className="mb-2 flex flex-wrap gap-2">
                  {createFindingPhotos.map((p, idx) => (
                    <div key={idx} className="relative h-[70px] w-[70px]">
                      <img src={p.secureUrl} alt="Preview" className="h-full w-full rounded-md border border-bd object-cover" />
                      <button
                        onClick={() => removeCreatePhoto(idx)}
                        className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full border-none bg-red text-[10px] text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  <label className="flex h-[70px] w-[70px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-t2 bg-transparent p-0">
                    <UploadCloud size={16} className="text-t2" />
                    <span className="mt-1 text-[10px] text-t2">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCreatePhotoUpload}
                      className="hidden"
                      disabled={isUploadingCreatePhoto}
                    />
                  </label>
                </div>
                {isUploadingCreatePhoto && <span className="text-xs text-brand-d">Converting and uploading WebP...</span>}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 border-t border-bd pt-3.5">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
                onClick={() => setIsCreateFindingModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-55"
                onClick={handleCreateFinding}
                disabled={isCreatingFinding || isUploadingCreatePhoto}
              >
                {isCreatingFinding ? "Saving..." : "Create Finding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Size / Compression Alert Modal */}
      {compressionAlert && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
          <div className="flex w-full max-w-[420px] flex-col items-center gap-3.5 rounded-lg border border-bd bg-bg1 p-6 text-center shadow-[var(--shadow-sm)]">
            <div className="inline-flex rounded-full bg-[#fef9c3] p-3 text-[#eab308]">
              <AlertTriangle size={36} />
            </div>

            <div>
              <h3 className="mb-1.5 text-lg font-extrabold">Large File Warning</h3>
              <p className="m-0 text-sm leading-relaxed text-t2">
                The selected image is <strong>{compressionAlert.sizeMb} MB</strong>, which exceeds the recommended 3 MB limit. For optimal load speeds, please compress it first:
              </p>
            </div>

            <a
              href="https://imagecompressor.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] bg-[#f1f5f9] p-2.5 text-[13px] font-semibold text-[#0f172a]"
            >
              <ExternalLink size={14} /> Open ImageCompressor.com
            </a>

            <div className="mt-1 flex w-full gap-2.5">
              <button
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-[13px] font-bold text-t1 hover:bg-bg3"
                onClick={() => setCompressionAlert(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-[13px] font-bold text-white hover:bg-brand-d"
                onClick={() => {
                  const fileToUpload = compressionAlert.file;
                  const isCreate = compressionAlert.isCreateForm;
                  setCompressionAlert(null);
                  if (isCreate) {
                    executeCreateUpload(fileToUpload);
                  } else {
                    executeUpload(fileToUpload);
                  }
                }}
              >
                Upload Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
