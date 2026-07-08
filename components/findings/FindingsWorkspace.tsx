"use client";

import { useMemo, useState } from "react";
import { apiPost, apiPatch, useApi } from "@/hooks/useApi";
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

type SessionUser = {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: "MASTER_ADMIN" | "ADMIN" | "AUDITOR" | "STORES_SPOC" | "PRODUCTION_SPOC" | "MANAGEMENT";
  department?: string;
};

type Masters = { 
  zones: Array<{ name: string; department: string }>; 
  questions: Array<{ _id: string; category: string; text: string; subSection: string }>;
  people: Array<{ _id: string; name: string; type: string; department?: string }>;
};

export function FindingsWorkspace() {
  const findingsApi = useApi<Finding[]>("/api/findings");
  const meApi = useApi<{ user: SessionUser | null }>("/api/auth/me");
  const masters = useApi<Masters>("/api/masters");
  
  const user = meApi.data?.user;

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

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

  // Check roles permissions
  const canSubmitCapa = useMemo(() => {
    if (!user) return false;
    if (user.role === "MASTER_ADMIN" || user.role === "ADMIN") return true;
    if (user.role === "STORES_SPOC" && selectedFinding?.department === "Stores") return true;
    if (user.role === "PRODUCTION_SPOC" && selectedFinding?.department === "Production") return true;
    // General check if user's department matches
    if (user.department && selectedFinding?.department === user.department) return true;
    return false;
  }, [user, selectedFinding]);

  const canReviewCapa = useMemo(() => {
    if (!user) return false;
    return ["MASTER_ADMIN", "ADMIN", "AUDITOR"].includes(user.role);
  }, [user]);

  function openDetails(finding: Finding) {
    setSelectedFinding(finding);
    setCapaAction(finding.capaAction || "");
    setClosureRemarks(finding.closureRemarks || "");
    setAfterPhotos(finding.afterPhotos || []);
    setRemarks("");
    setRejectionReason("");
    setIsEditingMetadata(false);
    setEditSeverity(finding.severity);
    setEditDueDate(finding.dueDate ? new Date(finding.dueDate).toISOString().split("T")[0] : "");
    setEditAssignedTo(finding.assignedTo || finding.department || "");
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

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await response.json();
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

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await response.json();
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
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">Findings & CAPA Dashboard</h1>
          <p className="page-sub">Track non-conformities, submit Corrective & Preventive Action plans (CAPA), and verify closures.</p>
        </div>
        {user && ["MASTER_ADMIN", "ADMIN", "AUDITOR"].includes(user.role) && (
          <button className="btn primary" onClick={() => setIsCreateFindingModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={16} /> Create Ad-Hoc Finding
          </button>
        )}
      </div>

      {note && <div className="alert" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{note}</div>}

      {/* Search and Filters Bar */}
      <div className="card" style={{ marginBottom: "20px", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search by ID, question, observation..."
              className="control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "36px" }}
            />
          </div>

          <select className="control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="REOPENED">REOPENED</option>
            <option value="OVERDUE">OVERDUE</option>
          </select>

          <select className="control" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select className="control" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="ALL">All Departments</option>
            {uniqueDepts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid Log */}
      <div className="card" style={{ padding: 0 }}>
        {findingsApi.loading ? (
          <div className="muted" style={{ padding: "24px", textAlign: "center" }}>Loading findings...</div>
        ) : filteredFindings.length === 0 ? (
          <div className="muted" style={{ padding: "24px", textAlign: "center" }}>No matching findings found.</div>
        ) : (
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Finding ID</th>
                  <th>Audit No</th>
                  <th>Observation Details</th>
                  <th>Department / Zone</th>
                  <th>Severity</th>
                  <th>Target Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((f) => {
                  const isOverdue = f.status === "OVERDUE" || (f.status !== "CLOSED" && f.dueDate && new Date(f.dueDate) < new Date());
                  return (
                    <tr 
                      key={f._id}
                      style={{ 
                        background: isOverdue ? "#fff5f5" : "transparent"
                      }}
                    >
                      <td><strong>{f.findingNumber}</strong></td>
                      <td><span className="muted" style={{ fontSize: "12px" }}>{f.auditNumber || "Manual"}</span></td>
                      <td style={{ maxWidth: "250px" }}>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{f.question}</div>
                        {f.observation && (
                          <div className="muted" style={{ fontSize: "11px", marginTop: "3px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {f.observation}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{f.department}</div>
                        <span className="muted" style={{ fontSize: "11px" }}>{f.zone}</span>
                      </td>
                      <td>
                        <span 
                          className="badge"
                          style={{
                            background: f.severity === "Critical" ? "#fee2e2" : f.severity === "High" ? "#ffedd5" : f.severity === "Medium" ? "#fef9c3" : "#f1f5f9",
                            color: f.severity === "Critical" ? "#991b1b" : f.severity === "High" ? "#c2410c" : f.severity === "Medium" ? "#854d0e" : "#475569",
                            borderColor: f.severity === "Critical" ? "#fecaca" : f.severity === "High" ? "#fed7aa" : f.severity === "Medium" ? "#fef08a" : "#cbd5e1"
                          }}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "5px", alignItems: "center", color: isOverdue ? "var(--danger)" : "inherit" }}>
                          {isOverdue && <AlertOctagon size={14} />}
                          <span>{f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "No Date"}</span>
                        </div>
                      </td>
                      <td>
                        <span 
                          className="badge"
                          style={{
                            background: f.status === "CLOSED" ? "#dcfce7" : f.status === "SUBMITTED" ? "#e0f2fe" : f.status === "REJECTED" || f.status === "OVERDUE" ? "#fee2e2" : "#f1f5f9",
                            color: f.status === "CLOSED" ? "#166534" : f.status === "SUBMITTED" ? "#0369a1" : f.status === "REJECTED" || f.status === "OVERDUE" ? "#991b1b" : "#475569",
                            borderColor: f.status === "CLOSED" ? "#bbf7d0" : f.status === "SUBMITTED" ? "#bae6fd" : f.status === "REJECTED" || f.status === "OVERDUE" ? "#fecaca" : "#cbd5e1"
                          }}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button className="btn" onClick={() => openDetails(f)} style={{ padding: "5px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Eye size={12} /> Open
                          </button>
                          {user && ["MASTER_ADMIN", "ADMIN"].includes(user.role) && (
                            <button 
                              className="btn" 
                              onClick={() => handleDeleteFinding(f._id)} 
                              style={{ padding: "5px 10px", fontSize: "12px", borderColor: "var(--danger)", color: "var(--danger)", display: "flex", alignItems: "center", gap: "4px" }}
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

      {/* DETAIL MODAL PANEL */}
      {selectedFinding && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: "rgba(15, 23, 42, 0.6)", 
            display: "grid", 
            placeItems: "center", 
            zIndex: 9999, 
            padding: "20px" 
          }}
        >
          <div 
            className="card" 
            style={{ 
              width: "100%", 
              maxWidth: "850px", 
              maxHeight: "92vh", 
              overflowY: "auto", 
              position: "relative",
              padding: "24px"
            }}
          >
            {/* Close */}
            <button 
              onClick={() => setSelectedFinding(null)}
              style={{ 
                position: "absolute", 
                top: "16px", 
                right: "16px", 
                background: "none", 
                border: "none", 
                cursor: "pointer", 
                color: "var(--muted)" 
              }}
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "18px" }}>
              <div>
                <span className="badge" style={{ marginBottom: "6px" }}>CAPA WORKFLOW</span>
                <h3 style={{ margin: 0, fontSize: "20px" }}>Finding: {selectedFinding.findingNumber}</h3>
                <span className="muted" style={{ fontSize: "13px" }}>
                  Spawned from Audit <strong>{selectedFinding.auditNumber || "Manual Setup"}</strong>
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span 
                  className="badge" 
                  style={{ 
                    fontSize: "14px", 
                    padding: "4px 12px",
                    background: selectedFinding.status === "CLOSED" ? "#dcfce7" : selectedFinding.status === "SUBMITTED" ? "#e0f2fe" : "#fee2e2",
                    color: selectedFinding.status === "CLOSED" ? "#166534" : selectedFinding.status === "SUBMITTED" ? "#0369a1" : "#991b1b"
                  }}
                >
                  {selectedFinding.status}
                </span>
              </div>
            </div>

            {/* Body Columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px" }}>
              {/* Left Column: Context, Issue Details & Timeline */}
              <div>
                <div style={{ display: "grid", gap: "14px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Question Context</h4>
                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>{selectedFinding.question}</div>
                  </div>

                  <div>
                    <h4 style={{ margin: "0 0 4px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Observation</h4>
                    <p style={{ margin: 0, fontSize: "13px", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                      {selectedFinding.observation || "No custom observations logged."}
                    </p>
                  </div>

                  {/* Before Photos */}
                  {selectedFinding.beforePhotos && selectedFinding.beforePhotos.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 6px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Audit Evidence (Before Photos)</h4>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {selectedFinding.beforePhotos.map((photo) => (
                          <a href={photo.secureUrl} target="_blank" rel="noopener noreferrer" key={photo.publicId}>
                            <img 
                              src={photo.secureUrl} 
                              alt="Before" 
                              style={{ width: "70px", height: "70px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--line)" }} 
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata Info (Auditor updates available if authorized) */}
                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "13px" }}>Action Metadata</strong>
                      {canReviewCapa && !isEditingMetadata && (
                        <button className="btn" onClick={() => setIsEditingMetadata(true)} style={{ padding: "3px 8px", fontSize: "11px" }}>
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditingMetadata ? (
                      <div style={{ display: "grid", gap: "10px" }}>
                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Severity</span>
                          <select className="control" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as any)}>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </label>
                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Target Due Date</span>
                          <input type="date" className="control" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                        </label>
                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Assigned Responsbility</span>
                          <input type="text" className="control" value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)} />
                        </label>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "5px" }}>
                          <button className="btn" onClick={() => setIsEditingMetadata(false)} style={{ padding: "4px 8px", fontSize: "12px" }}>Cancel</button>
                          <button className="btn primary" onClick={saveMetadataEdits} style={{ padding: "4px 8px", fontSize: "12px" }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                        <div>Zone: <strong>{selectedFinding.zone}</strong></div>
                        <div>Dept: <strong>{selectedFinding.department}</strong></div>
                        <div>Severity: <strong>{selectedFinding.severity}</strong></div>
                        <div>Due Date: <strong>{selectedFinding.dueDate ? new Date(selectedFinding.dueDate).toLocaleDateString() : "No Date"}</strong></div>
                        <div style={{ gridColumn: "span 2" }}>Assigned To: <strong>{selectedFinding.assignedTo || selectedFinding.department}</strong></div>
                      </div>
                    )}
                  </div>

                  {/* Timeline History */}
                  <div>
                    <h4 style={{ margin: "0 0 8px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Audit Trail History</h4>
                    <div style={{ display: "grid", gap: "10px", borderLeft: "2px solid var(--line)", paddingLeft: "12px", marginLeft: "6px" }}>
                      {selectedFinding.timeline.map((step, idx) => (
                        <div key={idx} style={{ position: "relative", fontSize: "12px" }}>
                          <div style={{ position: "absolute", left: "-19px", top: "3px", width: "12px", height: "12px", borderRadius: "50%", background: "var(--brand)", border: "2px solid #fff" }} />
                          <div style={{ fontWeight: 600 }}>{step.action}</div>
                          <div className="muted" style={{ fontSize: "11px" }}>by {step.byName} on {new Date(step.at || selectedFinding.createdAt).toLocaleString()}</div>
                          {step.note && <div style={{ marginTop: "2px", color: "var(--muted)", fontStyle: "italic" }}>"{step.note}"</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: CAPA Submission / Approval Review controls */}
              <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "20px" }}>
                {/* 1. CLOSED FINDING DISPLAY */}
                {selectedFinding.status === "CLOSED" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--ok)", fontWeight: "bold" }}>
                      <CheckCircle2 size={20} /> CAPA Closed & Approved
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Corrective Actions Executed</h4>
                      <p style={{ margin: 0, fontSize: "13px", padding: "10px", background: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                        {selectedFinding.capaAction}
                      </p>
                    </div>
                    {selectedFinding.closureRemarks && (
                      <div>
                        <h4 style={{ margin: "0 0 4px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Auditor Verification Notes</h4>
                        <p className="muted" style={{ margin: 0, fontSize: "12px" }}>"{selectedFinding.closureRemarks}"</p>
                      </div>
                    )}
                    {selectedFinding.afterPhotos && selectedFinding.afterPhotos.length > 0 && (
                      <div>
                        <h4 style={{ margin: "0 0 4px", fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Closure Proof (After Photos)</h4>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {selectedFinding.afterPhotos.map((p) => (
                            <a href={p.secureUrl} target="_blank" rel="noopener noreferrer" key={p.publicId}>
                              <img src={p.secureUrl} style={{ width: "60px", height: "60px", borderRadius: "4px", objectFit: "cover", border: "1px solid var(--line)" }} />
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
                      <div style={{ display: "grid", gap: "14px" }}>
                        <div style={{ fontWeight: "bold", fontSize: "14px", display: "flex", gap: "6px", alignItems: "center" }}>
                          <Clock size={16} className="muted" /> Submit CAPA Resolution
                        </div>

                        {selectedFinding.status === "REJECTED" && (
                          <div style={{ padding: "10px", borderRadius: "6px", background: "#fff5f5", border: "1px solid #fecaca", color: "var(--danger)", fontSize: "12px" }}>
                            <strong>Rejection Note:</strong> "{selectedFinding.rejectionReason}"
                          </div>
                        )}

                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Corrective & Preventive Action Plan</span>
                          <textarea
                            rows={3}
                            className="control"
                            placeholder="Describe the exact actions taken to resolve the non-conformity..."
                            value={capaAction}
                            onChange={(e) => setCapaAction(e.target.value)}
                          />
                        </label>

                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Closure Remarks (Optional)</span>
                          <input
                            type="text"
                            className="control"
                            placeholder="Additional closure notes..."
                            value={closureRemarks}
                            onChange={(e) => setClosureRemarks(e.target.value)}
                          />
                        </label>

                        <div className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Upload Resolution Proof (After Photos)</span>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <label className="btn" style={{ cursor: "pointer", fontSize: "12px", padding: "6px 12px" }}>
                              <UploadCloud size={14} /> {isUploading ? "Uploading..." : "Upload Photo"}
                              <input type="file" style={{ display: "none" }} disabled={isUploading} onChange={handlePhotoUpload} />
                            </label>
                          </div>
                        </div>

                        {afterPhotos.length > 0 && (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {afterPhotos.map((p, pIdx) => (
                              <div key={p.publicId} style={{ position: "relative", width: "60px", height: "60px", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--line)" }}>
                                <img src={p.secureUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <button
                                  onClick={() => removeAfterPhoto(pIdx)}
                                  style={{ position: "absolute", top: 1, right: 1, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 14, height: 14, fontSize: 8, padding: 0, cursor: "pointer" }}
                                >
                                  X
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button 
                          className="btn primary" 
                          disabled={isSubmittingCapa || !capaAction.trim()} 
                          onClick={submitCapaForm}
                          style={{ marginTop: "6px" }}
                        >
                          {isSubmittingCapa ? "Submitting..." : "Submit CAPA"}
                        </button>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: "13px", padding: "12px", background: "var(--surface)", borderRadius: "6px" }}>
                        Waiting for CAPA submission from the department SPOC (<strong>{selectedFinding.department}</strong>).
                      </div>
                    )}
                  </div>
                )}

                {/* 3. CAPA SUBMITTED REVIEW WORKFLOW */}
                {selectedFinding.status === "SUBMITTED" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    <div style={{ padding: "10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0369a1", marginBottom: "4px" }}>Pending Auditor Verification</div>
                      <div style={{ fontSize: "13px", fontStyle: "italic" }}>"{selectedFinding.capaAction}"</div>
                      
                      {selectedFinding.afterPhotos && selectedFinding.afterPhotos.length > 0 && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                          {selectedFinding.afterPhotos.map((p) => (
                            <a href={p.secureUrl} target="_blank" rel="noopener noreferrer" key={p.publicId}>
                              <img src={p.secureUrl} style={{ width: "50px", height: "50px", borderRadius: "4px", objectFit: "cover" }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {canReviewCapa ? (
                      <div style={{ display: "grid", gap: "10px" }}>
                        <strong style={{ fontSize: "13px" }}>Auditor Action Panel</strong>

                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="label">Verification / Rejection Comments</span>
                          <textarea
                            rows={2}
                            className="control"
                            placeholder="Provide audit signoff notes or rejection remarks..."
                            value={remarks}
                            onChange={(e) => {
                              setRemarks(e.target.value);
                              setRejectionReason(e.target.value);
                            }}
                          />
                        </label>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button 
                            className="btn" 
                            style={{ flex: 1, background: "var(--ok)", color: "#fff", borderColor: "var(--ok)", fontSize: "12px", padding: "8px" }} 
                            disabled={isSubmittingReview}
                            onClick={() => submitReview("approve")}
                          >
                            <Check size={14} /> Approve Closure
                          </button>
                          <button 
                            className="btn danger" 
                            style={{ flex: 1, fontSize: "12px", padding: "8px" }} 
                            disabled={isSubmittingReview || !rejectionReason.trim()}
                            onClick={() => submitReview("reject")}
                          >
                            <X size={14} /> Reject CAPA
                          </button>
                        </div>
                        <button 
                          className="btn" 
                          style={{ width: "100%", fontSize: "12px", padding: "6px" }} 
                          disabled={isSubmittingReview}
                          onClick={() => submitReview("reopen")}
                        >
                          Reopen Finding
                        </button>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: "13px", padding: "12px", background: "var(--surface)", borderRadius: "6px" }}>
                        Waiting for auditor to verify and sign off closure.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom */}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: "20px", paddingTop: "14px", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setSelectedFinding(null)}>Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE AD-HOC FINDING MODAL */}
      {isCreateFindingModalOpen && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: "rgba(15, 23, 42, 0.6)", 
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center", 
            zIndex: 9999, 
            padding: "20px" 
          }}
        >
          <div 
            className="card" 
            style={{ 
              width: "100%", 
              maxWidth: "600px", 
              maxHeight: "92vh", 
              overflowY: "auto", 
              position: "relative",
              padding: "24px"
            }}
          >
            {/* Close button */}
            <button 
              onClick={() => setIsCreateFindingModalOpen(false)}
              style={{ 
                position: "absolute", 
                top: "16px", 
                right: "16px", 
                background: "none", 
                border: "none", 
                cursor: "pointer", 
                color: "var(--muted)" 
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800 }}>Create Ad-Hoc Finding</h3>
            <p className="muted" style={{ fontSize: "13px", margin: "0 0 20px" }}>Log a new non-conformity finding directly to the database without a formal full-site audit.</p>

            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Pillar / Category</span>
                  <select 
                    className="control" 
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
                  <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Zone / Area</span>
                  <select 
                    className="control" 
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
                <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", fontSize: "13px", border: "1px solid var(--line)" }}>
                  <strong>Auto-detected Department: </strong>
                  <span style={{ color: "var(--brand-dark)", fontWeight: 600 }}>
                    {masters.data?.zones.find(z => z.name === createZone)?.department || "N/A"}
                  </span>
                </div>
              )}

              <label>
                <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Non-Conformity Description *</span>
                <textarea 
                  className="control" 
                  rows={3} 
                  placeholder="Describe the issue or condition found..."
                  value={createQuestion} 
                  onChange={(e) => setCreateQuestion(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Severity Level</span>
                  <select 
                    className="control" 
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
                  <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Target Due Date</span>
                  <input 
                    type="date" 
                    className="control" 
                    value={createDueDate} 
                    onChange={(e) => setCreateDueDate(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                <label>
                  <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Assignee (SPOC / Person Responsible)</span>
                  <select 
                    className="control" 
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
                <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Additional Observation / Details</span>
                <textarea 
                  className="control" 
                  rows={2} 
                  placeholder="Optional details, context, or notes..."
                  value={createObservation} 
                  onChange={(e) => setCreateObservation(e.target.value)}
                />
              </label>

              <div>
                <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px" }}>Evidence Photos (Before)</span>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                  {createFindingPhotos.map((p, idx) => (
                    <div key={idx} style={{ position: "relative", width: "70px", height: "70px" }}>
                      <img src={p.secureUrl} alt="Preview" style={{ width: "100%", height: "100%", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--line)" }} />
                      <button 
                        onClick={() => removeCreatePhoto(idx)}
                        style={{ position: "absolute", top: "-4px", right: "-4px", background: "var(--danger)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  <label 
                    className="btn" 
                    style={{ 
                      width: "70px", 
                      height: "70px", 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      border: "1px dashed var(--muted)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      padding: 0,
                      background: "transparent"
                    }}
                  >
                    <UploadCloud size={16} className="muted" />
                    <span style={{ fontSize: "10px", marginTop: "4px" }} className="muted">Add</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleCreatePhotoUpload} 
                      style={{ display: "none" }} 
                      disabled={isUploadingCreatePhoto}
                    />
                  </label>
                </div>
                {isUploadingCreatePhoto && <span style={{ fontSize: "12px", color: "var(--brand-dark)" }}>Converting and uploading WebP...</span>}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", marginTop: "20px", paddingTop: "14px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn" onClick={() => setIsCreateFindingModalOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={handleCreateFinding} disabled={isCreatingFinding || isUploadingCreatePhoto}>
                {isCreatingFinding ? "Saving..." : "Create Finding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Size / Compression Alert Modal */}
      {compressionAlert && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 100000,
            padding: "20px"
          }}
        >
          <div 
            className="card" 
            style={{ 
              width: "100%", 
              maxWidth: "420px", 
              padding: "24px", 
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px"
            }}
          >
            <div style={{ color: "#eab308", background: "#fef9c3", borderRadius: "50%", padding: "12px", display: "inline-flex" }}>
              <AlertTriangle size={36} />
            </div>
            
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 6px" }}>Large File Warning</h3>
              <p className="muted" style={{ fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
                The selected image is <strong>{compressionAlert.sizeMb} MB</strong>, which exceeds the recommended 3 MB limit. For optimal load speeds, please compress it first:
              </p>
            </div>

            <a 
              href="https://imagecompressor.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn"
              style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: "8px", 
                width: "100%", 
                background: "#f1f5f9",
                borderColor: "#cbd5e1",
                color: "#0f172a",
                padding: "10px",
                fontWeight: 600,
                fontSize: "13px"
              }}
            >
              <ExternalLink size={14} /> Open ImageCompressor.com
            </a>

            <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "4px" }}>
              <button 
                className="btn" 
                style={{ flex: 1, fontSize: "13px" }} 
                onClick={() => setCompressionAlert(null)}
              >
                Cancel
              </button>
              <button 
                className="btn primary" 
                style={{ flex: 1, fontSize: "13px" }}
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
