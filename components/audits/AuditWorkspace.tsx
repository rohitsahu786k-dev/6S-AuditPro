"use client";

import { useMemo, useState } from "react";
import { apiPost, useApi } from "@/hooks/useApi";
import { CATEGORIES } from "@/lib/constants";
import { 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  UploadCloud, 
  Calendar, 
  User, 
  MapPin, 
  CheckCircle2, 
  Plus, 
  Eye,
  AlertOctagon,
  AlertTriangle,
  Info,
  ExternalLink
} from "lucide-react";
import { defaultSeverity } from "@/lib/audit-scoring";
import { processImageToWebP } from "@/utils/media";

type Masters = { 
  zones: Array<{ name: string; department: string }>; 
  questions: Array<{ _id: string; category: string; text: string; subSection: string }>;
  people: Array<{ _id: string; name: string; type: string; department?: string }>;
};

type Audit = { 
  _id: string; 
  auditNumber: string; 
  zone: string; 
  department: string; 
  auditorName: string; 
  totalScore: number; 
  date: string;
  checklist: Array<{
    questionId: string;
    category: string;
    question: string;
    response: "Adequate" | "Not Adequate" | "N/A";
    observation?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
    beforePhotos?: Array<{ secureUrl: string; publicId: string }>;
  }>;
  categoryScores: Record<string, number>;
  findingIds?: string[];
};

type Finding = {
  _id: string;
  findingNumber: string;
  question: string;
  category: string;
  severity: string;
  observation?: string;
};

export function AuditWorkspace() {
  const masters = useApi<Masters>("/api/masters");
  const audits = useApi<Audit[]>("/api/audits");
  const meApi = useApi<{ user: any | null }>("/api/auth/me");
  
  const currentUser = meApi.data?.user;
  const isUserAdmin = currentUser && ["MASTER_ADMIN", "ADMIN"].includes(currentUser.role);
  
  // Navigation & Step State
  const [step, setStep] = useState<"history" | "setup" | "checklist" | "success">("history");
  
  // Setup Form State
  const [zoneName, setZoneName] = useState("");
  const [auditorName, setAuditorName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [setupError, setSetupError] = useState("");

  // Checklist State
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, {
    response: "Adequate" | "Not Adequate" | "N/A";
    observation?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
    beforePhotos?: Array<{ secureUrl: string; publicId: string }>;
  }>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Success Screen State
  const [createdAudit, setCreatedAudit] = useState<Audit | null>(null);
  const [createdFindings, setCreatedFindings] = useState<Finding[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal State
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<Audit | null>(null);
  
  // Image Compression Alert State
  const [compressionAlert, setCompressionAlert] = useState<{
    file: File;
    sizeMb: string;
    questionId: string;
  } | null>(null);

  // Derived Info
  const selectedZone = useMemo(() => {
    return masters.data?.zones.find((z) => z.name === zoneName);
  }, [zoneName, masters.data]);

  const auditors = useMemo(() => {
    return masters.data?.people.filter((p) => p.type === "AUDITOR") || [];
  }, [masters.data]);

  const activeCategory = CATEGORIES[currentCategoryIndex];

  const categoryQuestions = useMemo(() => {
    if (!masters.data?.questions) return [];
    return masters.data.questions.filter((q) => q.category === activeCategory);
  }, [masters.data, activeCategory]);

  // Calculate stats
  const totalQuestionsCount = masters.data?.questions.length || 0;
  const answeredQuestionsCount = Object.keys(checklistResponses).length;
  const completionPercentage = totalQuestionsCount > 0 
    ? Math.round((answeredQuestionsCount / totalQuestionsCount) * 100)
    : 0;

  // Calculate status of category tabs
  const getCategoryStat = (catName: string) => {
    if (!masters.data?.questions) return { answered: 0, total: 0 };
    const catQuestions = masters.data.questions.filter((q) => q.category === catName);
    const answeredInCat = catQuestions.filter((q) => checklistResponses[q._id]).length;
    return { answered: answeredInCat, total: catQuestions.length };
  };

  async function handlePhotoUpload(questionId: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    if (file.size > 3 * 1024 * 1024) {
      setCompressionAlert({
        file,
        sizeMb,
        questionId
      });
      event.target.value = "";
      return;
    }

    await executeUpload(file, questionId);
    event.target.value = "";
  }

  async function executeUpload(file: File, questionId: string) {
    setUploading(prev => ({ ...prev, [questionId]: true }));
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

      const uploadResult = await response.json();
      
      setChecklistResponses(prev => {
        const curr = prev[questionId] || { response: "Adequate" };
        const photos = curr.beforePhotos ? [...curr.beforePhotos] : [];
        photos.push({ secureUrl: uploadResult.secureUrl, publicId: uploadResult.publicId });
        return {
          ...prev,
          [questionId]: {
            ...curr,
            beforePhotos: photos
          }
        };
      });
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploading(prev => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleDeleteAudit(auditId: string) {
    if (!window.confirm("Are you sure you want to delete this audit report? All associated findings and CAPA requests will be deleted permanently. This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/audits/${auditId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Delete failed");
      }

      alert("Audit deleted successfully.");
      await audits.reload();
    } catch (err: any) {
      alert(`Error deleting audit: ${err.message}`);
    }
  }

  function handleRemovePhoto(questionId: string, photoIndex: number) {
    setChecklistResponses(prev => {
      const curr = prev[questionId];
      if (!curr || !curr.beforePhotos) return prev;
      const photos = [...curr.beforePhotos];
      photos.splice(photoIndex, 1);
      return {
        ...prev,
        [questionId]: {
          ...curr,
          beforePhotos: photos
        }
      };
    });
  }

  function startAuditSetup() {
    setZoneName("");
    setAuditorName("");
    setDate(new Date().toISOString().split("T")[0]);
    setChecklistResponses({});
    setCurrentCategoryIndex(0);
    setSetupError("");
    setStep("setup");
  }

  function validateSetupAndStart() {
    if (!zoneName) {
      setSetupError("Please select a target zone.");
      return;
    }
    if (!auditorName) {
      setSetupError("Please select or enter an auditor name.");
      return;
    }
    setStep("checklist");
  }

  async function submitFullAudit() {
    if (!masters.data) return;
    
    // Check if everything is answered
    const unanswered = masters.data.questions.filter((q) => !checklistResponses[q._id]);
    if (unanswered.length > 0) {
      alert(`There are ${unanswered.length} unanswered questions. Please review and answer all items before submitting.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const checklistPayload = masters.data.questions.map((q) => {
        const answer = checklistResponses[q._id];
        return {
          questionId: q._id,
          category: q.category,
          question: q.text,
          response: answer.response,
          observation: answer.response === "Not Adequate" ? answer.observation || "" : undefined,
          severity: answer.response === "Not Adequate" ? answer.severity || defaultSeverity(answer.response, q.category) : undefined,
          beforePhotos: answer.response === "Not Adequate" ? answer.beforePhotos || [] : []
        };
      });

      const response = await apiPost<any>("/api/audits", {
        zone: selectedZone?.name,
        department: selectedZone?.department,
        auditorName,
        date: new Date(date),
        checklist: checklistPayload
      });

      setCreatedAudit(response.audit);
      setCreatedFindings(response.findings || []);
      setStep("success");
      await audits.reload();
    } catch (err: any) {
      alert(`Failed to save audit: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">6S Site Audits</h1>
          <p className="page-sub">Establish and verify workplace discipline and safety standards via systematic scoring audits.</p>
        </div>
        {step === "history" && (
          <button className="btn primary" onClick={startAuditSetup}>
            <Plus size={16} /> Start Audit
          </button>
        )}
      </div>

      {/* STEP 1: HISTORY VIEW */}
      {step === "history" && (
        <div className="grid grid-3" style={{ gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
          {/* Audit History List */}
          <div className="card">
            <h2 className="card-title">Completed Audits Log</h2>
            {audits.loading ? (
              <div className="muted" style={{ padding: "20px 0" }}>Loading completed audits...</div>
            ) : !audits.data || audits.data.length === 0 ? (
              <div className="muted" style={{ padding: "20px 0" }}>No audits completed yet. Start your first site audit.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Audit No</th>
                      <th>Zone / Dept</th>
                      <th>Auditor</th>
                      <th>Score</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.data.map((audit) => (
                      <tr key={audit._id}>
                        <td>
                          <strong>{audit.auditNumber}</strong>
                        </td>
                        <td>
                          <div>{audit.zone}</div>
                          <span className="muted" style={{ fontSize: "11px" }}>{audit.department}</span>
                        </td>
                        <td>{audit.auditorName}</td>
                        <td>
                          <span 
                            className="badge" 
                            style={{ 
                              background: audit.totalScore >= 90 ? "#dcfce7" : audit.totalScore >= 75 ? "#fef9c3" : "#fee2e2",
                              color: audit.totalScore >= 90 ? "#166534" : audit.totalScore >= 75 ? "#854d0e" : "#991b1b",
                              borderColor: audit.totalScore >= 90 ? "#bbf7d0" : audit.totalScore >= 75 ? "#fef08a" : "#fecaca"
                            }}
                          >
                            {audit.totalScore}%
                          </span>
                        </td>
                        <td>{new Date(audit.date).toLocaleDateString()}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button 
                              className="btn" 
                              onClick={() => setSelectedAuditDetail(audit)}
                              style={{ padding: "5px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <Eye size={12} /> View
                            </button>
                            {isUserAdmin && (
                              <button
                                className="btn"
                                onClick={() => handleDeleteAudit(audit._id)}
                                style={{ padding: "5px 10px", fontSize: "12px", borderColor: "var(--danger)", color: "var(--danger)", display: "flex", alignItems: "center", gap: "4px" }}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Guidelines Box */}
          <div className="card" style={{ display: "flex", flexDirection: "column", justifySelf: "stretch" }}>
            <h2 className="card-title">6S Scoring Guidelines</h2>
            <div style={{ display: "grid", gap: "12px", fontSize: "13px" }}>
              <div style={{ padding: "10px", borderRadius: "8px", background: "#f8fafc", borderLeft: "4px solid #ef2b2d" }}>
                <strong>Multi-Step Checklist</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>Audits cover 7 pillars: Sort, Set in Order, Shine, Standardize, Sustain, Safety, Environment.</p>
              </div>
              <div style={{ padding: "10px", borderRadius: "8px", background: "#f8fafc", borderLeft: "4px solid #16a34a" }}>
                <strong>Scoring Metrics</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>Adequate adds 1 point. Not Adequate adds 0 points and requires a description. N/A excludes the question.</p>
              </div>
              <div style={{ padding: "10px", borderRadius: "8px", background: "#f8fafc", borderLeft: "4px solid #ea580c" }}>
                <strong>CAPA Trigger</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>Any finding marked "Not Adequate" instantly spawns an active CAPA ticket assigned to the department SPOC.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: SETUP CONFIG */}
      {step === "setup" && (
        <div style={{ maxWidth: "600px", margin: "20px auto" }} className="card">
          <h2 className="card-title">Audit Configurations</h2>
          {setupError && <div className="alert">{setupError}</div>}

          <div style={{ display: "grid", gap: "16px" }}>
            <label className="field">
              <span className="label">Audit Zone</span>
              <select 
                className="control" 
                value={zoneName} 
                onChange={(e) => setZoneName(e.target.value)}
              >
                <option value="">Select Audit Area / Zone</option>
                {masters.data?.zones.map((z) => (
                  <option key={z.name} value={z.name}>{z.name}</option>
                ))}
              </select>
            </label>

            {selectedZone && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--line)", display: "flex", gap: "10px", alignItems: "center" }}>
                <MapPin size={16} className="muted" />
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "bold", color: "var(--muted)" }}>Target Department</div>
                  <strong>{selectedZone.department}</strong>
                </div>
              </div>
            )}

            <label className="field">
              <span className="label">Lead Auditor</span>
              <select 
                className="control" 
                value={auditorName} 
                onChange={(e) => setAuditorName(e.target.value)}
              >
                <option value="">Select Auditor</option>
                {auditors.map((p) => (
                  <option key={p._id} value={p.name}>{p.name}</option>
                ))}
                <option value="Lead Auditor">Lead Auditor (Fallback)</option>
              </select>
            </label>

            <label className="field">
              <span className="label">Audit Date</span>
              <input 
                type="date" 
                className="control" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
              />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <button className="btn" onClick={() => setStep("history")}>Cancel</button>
              <button className="btn primary" onClick={validateSetupAndStart}>
                Next: Start Checklist <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: INTERACTIVE CHECKLIST */}
      {step === "checklist" && masters.data && (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Progress Header */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 800 }}>Audit Progress Checklist</span>
              <span className="muted" style={{ fontSize: "14px" }}>
                {answeredQuestionsCount} of {totalQuestionsCount} Answered ({completionPercentage}%)
              </span>
            </div>
            <div style={{ height: "8px", background: "var(--surface)", borderRadius: "4px", overflow: "hidden" }}>
              <div 
                style={{ 
                  height: "100%", 
                  background: "var(--brand)", 
                  width: `${completionPercentage}%`, 
                  transition: "width 0.3s ease" 
                }} 
              />
            </div>
          </div>

          {/* Category Navigation Pills */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "5px" }}>
            {CATEGORIES.map((cat, idx) => {
              const stats = getCategoryStat(cat);
              const isSelected = currentCategoryIndex === idx;
              const isDone = stats.answered === stats.total;
              return (
                <button
                  key={cat}
                  onClick={() => setCurrentCategoryIndex(idx)}
                  className="btn"
                  style={{
                    flexShrink: 0,
                    background: isSelected ? "var(--brand-soft)" : isDone ? "#f0fdf4" : "#fff",
                    color: isSelected ? "var(--brand-dark)" : isDone ? "#166534" : "var(--ink)",
                    borderColor: isSelected ? "var(--brand)" : isDone ? "#bbf7d0" : "var(--line)",
                    padding: "8px 14px",
                    fontWeight: 700,
                    fontSize: "13px"
                  }}
                >
                  {isDone && <Check size={14} style={{ marginRight: "4px" }} />}
                  {cat} ({stats.answered}/{stats.total})
                </button>
              );
            })}
          </div>

          {/* Question Work Area */}
          <div className="card" style={{ display: "grid", gap: "24px" }}>
            <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, textTransform: "uppercase", fontSize: "16px", color: "var(--brand)" }}>
                Pillar Category: {activeCategory}
              </h3>
            </div>

            {categoryQuestions.length === 0 ? (
              <div className="muted">No questions seeded for this category.</div>
            ) : (
              <div style={{ display: "grid", gap: "20px" }}>
                {categoryQuestions.map((q, idx) => {
                  const state = checklistResponses[q._id];
                  const resp = state?.response;
                  return (
                    <div 
                      key={q._id} 
                      style={{ 
                        padding: "16px", 
                        borderRadius: "8px", 
                        background: resp === "Adequate" ? "#f0fdf4" : resp === "Not Adequate" ? "#fef2f2" : "#f8fafc",
                        border: "1px solid",
                        borderColor: resp === "Adequate" ? "#bbf7d0" : resp === "Not Adequate" ? "#fecaca" : "var(--line)",
                        display: "grid",
                        gap: "12px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
                        <div>
                          <span 
                            style={{ 
                              fontSize: "10px", 
                              fontWeight: 900, 
                              color: "var(--brand)", 
                              textTransform: "uppercase", 
                              letterSpacing: "0.06em",
                              display: "block",
                              marginBottom: "3px"
                            }}
                          >
                            {q.subSection || "STANDARD"}
                          </span>
                          <strong style={{ fontSize: "15px", lineHeight: 1.4 }}>{idx + 1}. {q.text}</strong>
                        </div>

                        {/* Control Buttons */}
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button
                            className="btn"
                            onClick={() => setChecklistResponses(prev => ({ 
                              ...prev, 
                              [q._id]: { ...prev[q._id], response: "Adequate" } 
                            }))}
                            style={{
                              background: resp === "Adequate" ? "var(--ok)" : "#fff",
                              color: resp === "Adequate" ? "#fff" : "var(--ink)",
                              borderColor: resp === "Adequate" ? "var(--ok)" : "var(--line)",
                              padding: "6px 12px",
                              fontSize: "13px"
                            }}
                          >
                            Adequate
                          </button>
                          <button
                            className="btn"
                            onClick={() => {
                              const defaultSev = defaultSeverity("Not Adequate", activeCategory);
                              setChecklistResponses(prev => ({ 
                                ...prev, 
                                [q._id]: { 
                                  ...prev[q._id], 
                                  response: "Not Adequate", 
                                  severity: defaultSev,
                                  observation: prev[q._id]?.observation || ""
                                } 
                              }));
                            }}
                            style={{
                              background: resp === "Not Adequate" ? "var(--danger)" : "#fff",
                              color: resp === "Not Adequate" ? "#fff" : "var(--ink)",
                              borderColor: resp === "Not Adequate" ? "var(--danger)" : "var(--line)",
                              padding: "6px 12px",
                              fontSize: "13px"
                            }}
                          >
                            Not Adequate
                          </button>
                          <button
                            className="btn"
                            onClick={() => setChecklistResponses(prev => ({ 
                              ...prev, 
                              [q._id]: { ...prev[q._id], response: "N/A" } 
                            }))}
                            style={{
                              background: resp === "N/A" ? "var(--muted)" : "#fff",
                              color: resp === "N/A" ? "#fff" : "var(--ink)",
                              borderColor: resp === "N/A" ? "var(--muted)" : "var(--line)",
                              padding: "6px 12px",
                              fontSize: "13px"
                            }}
                          >
                            N/A
                          </button>
                        </div>
                      </div>

                      {/* Not Adequate Inputs (Observation, Severity, Photos) */}
                      {resp === "Not Adequate" && (
                        <div 
                          style={{ 
                            marginTop: "8px", 
                            paddingTop: "14px", 
                            borderTop: "1px dashed #fca5a5", 
                            display: "grid", 
                            gap: "12px", 
                            gridTemplateColumns: "1fr 1fr" 
                          }}
                        >
                          <label className="field" style={{ gridColumn: "span 2", marginBottom: 0 }}>
                            <span className="label" style={{ color: "var(--brand-dark)" }}>Observation / Non-Conformity Description</span>
                            <textarea
                              className="control"
                              rows={2}
                              placeholder="Describe the exact issue or standard deviation..."
                              value={state.observation || ""}
                              onChange={(e) => setChecklistResponses(prev => ({
                                ...prev,
                                [q._id]: { ...prev[q._id], observation: e.target.value }
                              }))}
                            />
                          </label>

                          <label className="field" style={{ marginBottom: 0 }}>
                            <span className="label">Finding Severity</span>
                            <select
                              className="control"
                              value={state.severity || "Medium"}
                              onChange={(e) => setChecklistResponses(prev => ({
                                ...prev,
                                [q._id]: { ...prev[q._id], severity: e.target.value as any }
                              }))}
                            >
                              <option value="Critical">Critical (Immediate stop / Safety danger)</option>
                              <option value="High">High (Major standard breach)</option>
                              <option value="Medium">Medium (General standard deviation)</option>
                              <option value="Low">Low (Minor housekeeping issue)</option>
                            </select>
                          </label>

                          <div className="field" style={{ marginBottom: 0 }}>
                            <span className="label">Audit Evidence (Before Photos)</span>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <label 
                                className="btn" 
                                style={{ 
                                  cursor: "pointer", 
                                  background: "#fff", 
                                  borderColor: "var(--line)", 
                                  fontSize: "13px",
                                  padding: "8px 12px"
                                }}
                              >
                                <UploadCloud size={16} className="muted" />
                                {uploading[q._id] ? "Uploading..." : "Upload Photo"}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  style={{ display: "none" }}
                                  disabled={uploading[q._id]}
                                  onChange={(e) => handlePhotoUpload(q._id, e)} 
                                />
                              </label>
                            </div>
                          </div>

                          {/* Uploaded thumbnails */}
                          {state.beforePhotos && state.beforePhotos.length > 0 && (
                            <div style={{ gridColumn: "span 2", display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                              {state.beforePhotos.map((photo, pIdx) => (
                                <div 
                                  key={photo.publicId} 
                                  style={{ 
                                    position: "relative", 
                                    width: "80px", 
                                    height: "80px", 
                                    borderRadius: "6px", 
                                    border: "1px solid var(--line)", 
                                    overflow: "hidden" 
                                  }}
                                >
                                  <img 
                                    src={photo.secureUrl} 
                                    alt="Evidence" 
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                                  />
                                  <button
                                    onClick={() => handleRemovePhoto(q._id, pIdx)}
                                    style={{
                                      position: "absolute",
                                      top: "2px",
                                      right: "2px",
                                      background: "rgba(220, 38, 38, 0.9)",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: "18px",
                                      height: "18px",
                                      display: "grid",
                                      placeItems: "center",
                                      cursor: "pointer",
                                      padding: 0
                                    }}
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Steps Navigation Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
            <button
              className="btn"
              onClick={() => {
                if (currentCategoryIndex > 0) {
                  setCurrentCategoryIndex(prev => prev - 1);
                } else {
                  setStep("setup");
                }
              }}
            >
              <ChevronLeft size={16} /> Back
            </button>

            {currentCategoryIndex < CATEGORIES.length - 1 ? (
              <button
                className="btn primary"
                onClick={() => setCurrentCategoryIndex(prev => prev + 1)}
              >
                Next Category <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={submitFullAudit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting Audit..." : "Submit Completed Audit"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS VIEW */}
      {step === "success" && createdAudit && (
        <div style={{ maxWidth: "600px", margin: "30px auto", textAlign: "center" }} className="card">
          <div style={{ color: "var(--ok)", marginBottom: "16px" }}>
            <CheckCircle2 size={64} style={{ margin: "0 auto" }} />
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px" }}>Audit Submitted Successfully!</h2>
          <p className="muted" style={{ fontSize: "15px", marginBottom: "24px" }}>
            Audit report <strong>{createdAudit.auditNumber}</strong> has been logged. Scores have been cascaded and department SPOCs notified.
          </p>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "14px" }}>
              <div>Zone: <strong>{createdAudit.zone}</strong></div>
              <div>Department: <strong>{createdAudit.department}</strong></div>
              <div>Auditor: <strong>{createdAudit.auditorName}</strong></div>
              <div>Total 6S Score: <strong style={{ color: createdAudit.totalScore >= 90 ? "var(--ok)" : "var(--brand)" }}>{createdAudit.totalScore}%</strong></div>
            </div>

            {createdFindings && createdFindings.length > 0 && (
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--danger)", marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center" }}>
                  <AlertTriangle size={14} /> Created {createdFindings.length} Non-Conformity Findings:
                </div>
                <div style={{ display: "grid", gap: "6px" }}>
                  {createdFindings.map((f) => (
                    <div key={f._id} style={{ fontSize: "13px", padding: "6px 10px", background: "#fff", border: "1px solid #fecaca", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                      <span><strong>{f.findingNumber}</strong>: {f.question}</span>
                      <span className="badge" style={{ padding: "1px 6px", fontSize: "10px", background: f.severity === "Critical" ? "#fee2e2" : "#fef3c7", color: f.severity === "Critical" ? "#991b1b" : "#d97706" }}>{f.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="btn primary" onClick={() => setStep("history")}>
            Back to Audits List
          </button>
        </div>
      )}

      {/* DETAIL DIALOG MODAL */}
      {selectedAuditDetail && (
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
              maxWidth: "800px", 
              maxHeight: "90vh", 
              overflowY: "auto", 
              position: "relative",
              padding: "24px"
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedAuditDetail(null)}
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "18px" }}>
              <div>
                <span className="badge" style={{ marginBottom: "6px" }}>COMPLETED REPORT</span>
                <h3 style={{ margin: 0, fontSize: "20px" }}>Audit Details: {selectedAuditDetail.auditNumber}</h3>
                <span className="muted" style={{ fontSize: "13px" }}>
                  Performed on {new Date(selectedAuditDetail.date).toLocaleDateString()}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--muted)" }}>Audit Score</div>
                <div style={{ fontSize: "32px", fontWeight: 900, color: selectedAuditDetail.totalScore >= 90 ? "var(--ok)" : "var(--brand)" }}>
                  {selectedAuditDetail.totalScore}%
                </div>
              </div>
            </div>

            {/* Audit Info Card */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", marginBottom: "18px", fontSize: "14px" }}>
              <div>
                <div className="muted" style={{ fontSize: "11px" }}>ZONE AREA</div>
                <strong>{selectedAuditDetail.zone}</strong>
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px" }}>DEPARTMENT</div>
                <strong>{selectedAuditDetail.department}</strong>
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px" }}>LEAD AUDITOR</div>
                <strong>{selectedAuditDetail.auditorName}</strong>
              </div>
            </div>

            {/* Category Pillars Breakdown */}
            <div style={{ marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                Score breakdown by pillar
              </h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {Object.entries(selectedAuditDetail.categoryScores || {}).map(([cat, score]) => (
                  <div key={cat} style={{ padding: "8px 12px", borderRadius: "6px", background: "#f8fafc", border: "1px solid var(--line)", minWidth: "90px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "bold" }}>{cat}</div>
                    <strong style={{ fontSize: "14px" }}>{score}%</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist Details */}
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                Full Response checklist
              </h4>
              <div style={{ display: "grid", gap: "8px" }}>
                {selectedAuditDetail.checklist.map((item, idx) => (
                  <div 
                    key={item.questionId} 
                    style={{ 
                      padding: "12px", 
                      borderRadius: "6px", 
                      background: item.response === "Adequate" ? "#f0fdf4" : item.response === "Not Adequate" ? "#fef2f2" : "#f8fafc",
                      border: "1px solid",
                      borderColor: item.response === "Adequate" ? "#bbf7d0" : item.response === "Not Adequate" ? "#fecaca" : "var(--line)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "9px", color: "var(--brand-dark)", fontWeight: "bold", textTransform: "uppercase" }}>
                          [{item.category}]
                        </span>
                        <div style={{ fontSize: "13px", fontWeight: "bold", marginTop: "2px" }}>
                          {idx + 1}. {item.question}
                        </div>
                        {item.observation && (
                          <div style={{ fontSize: "12px", marginTop: "4px", color: "var(--danger)" }}>
                            <strong>Observation:</strong> {item.observation}
                          </div>
                        )}
                      </div>
                      <div>
                        <span 
                          className="badge"
                          style={{
                            background: item.response === "Adequate" ? "var(--ok)" : item.response === "Not Adequate" ? "var(--danger)" : "var(--muted)",
                            color: "#fff",
                            borderColor: "transparent",
                            fontSize: "11px",
                            padding: "2px 8px"
                          }}
                        >
                          {item.response}
                        </span>
                        {item.severity && (
                          <span 
                            className="badge" 
                            style={{ 
                              marginLeft: "4px", 
                              fontSize: "10px",
                              background: "#fef3c7", 
                              color: "#d97706",
                              borderColor: "#fde68a"
                            }}
                          >
                            {item.severity}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Photo attachments */}
                    {item.beforePhotos && item.beforePhotos.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                        {item.beforePhotos.map((p) => (
                          <a href={p.secureUrl} target="_blank" rel="noopener noreferrer" key={p.publicId}>
                            <img 
                              src={p.secureUrl} 
                              alt="Observation evidence" 
                              style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover", border: "1px solid var(--line)" }} 
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setSelectedAuditDetail(null)}>Close</button>
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
                  const qId = compressionAlert.questionId;
                  setCompressionAlert(null);
                  executeUpload(fileToUpload, qId);
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
