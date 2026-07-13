"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiUpload, useApi } from "@/hooks/useApi";
import { CATEGORIES } from "@/lib/constants";
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  UploadCloud,
  MapPin,
  CheckCircle2,
  Plus,
  Eye,
  AlertTriangle,
  ExternalLink,
  Mail,
  Download
} from "lucide-react";
import { defaultSeverity } from "@/lib/audit-scoring";
import { downloadAuditPdf } from "@/lib/audit-pdf";
import { processImageToWebP } from "@/utils/media";
import { scoreBadgeStyle, SEVERITY_BADGE_STYLES } from "@/lib/status-styles";
import type { Severity } from "@/types/domain";

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
    beforePhotos?: Array<UploadedPhoto>;
  }>;
  // Stored either as a plain number or as the { adequate, total, score } shape from scoreChecklist()
  categoryScores: Record<string, number | { adequate: number; total: number; score: number }>;
  findingIds?: string[];
};

function categoryScoreValue(score: number | { adequate: number; total: number; score: number }): number {
  return typeof score === "object" && score !== null ? score.score ?? 0 : score;
}

type Finding = {
  _id: string;
  findingNumber: string;
  question: string;
  category: string;
  severity: string;
  observation?: string;
};

type UploadedPhoto = { secureUrl: string; publicId: string; sizeBytes?: number; uploadedBy?: string; uploadedByName?: string };

function responseBadgeClass(response: "Adequate" | "Not Adequate" | "N/A") {
  if (response === "Adequate") return "bg-green";
  if (response === "Not Adequate") return "bg-red";
  return "bg-t2";
}

export function AuditWorkspace({ historyOnly = false, newOnly = false }: { historyOnly?: boolean; newOnly?: boolean }) {
  const router = useRouter();
  const masters = useApi<Masters>("/api/masters");
  const audits = useApi<Audit[]>("/api/audits");
  const meApi = useApi<{ user: any | null }>("/api/auth/me");

  const currentUser = meApi.data?.user;
  const isUserAdmin = currentUser && ["MASTER_ADMIN", "ADMIN"].includes(currentUser.role);

  // Navigation & Step State ("New Audit" page jumps straight into the setup form)
  const [step, setStep] = useState<"history" | "setup" | "checklist" | "success">(newOnly ? "setup" : "history");

  // In newOnly mode the history list lives on /audit-history, so "back to
  // history" navigates there instead of switching the local step.
  function goToHistory() {
    if (newOnly) router.push("/audit-history");
    else setStep("history");
  }
  
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
    beforePhotos?: Array<UploadedPhoto>;
  }>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Success Screen State
  const [createdAudit, setCreatedAudit] = useState<Audit | null>(null);
  const [createdFindings, setCreatedFindings] = useState<Finding[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal State
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<Audit | null>(null);
  const [downloadingAuditId, setDownloadingAuditId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDepartment, setHistoryDepartment] = useState("ALL");
  const [historyZone, setHistoryZone] = useState("ALL");

  // Share Report State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  const handleShareReport = async () => {
    if (!selectedAuditDetail || !shareEmail.trim()) return;
    setIsSharing(true);
    setShareMsg("");
    try {
      await apiPost(`/api/audits/${selectedAuditDetail._id}/share`, { email: shareEmail.trim() });
      setShareMsg("Report shared successfully.");
      setShareEmail("");
      setTimeout(() => { setIsShareOpen(false); setShareMsg(""); }, 1500);
    } catch (err: any) {
      setShareMsg(err.message || "Failed to share report.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPdf = async (audit: Audit) => {
    setDownloadingAuditId(audit._id);
    try {
      await downloadAuditPdf(audit);
    } catch (error) {
      alert(error instanceof Error ? `Unable to create PDF: ${error.message}` : "Unable to create PDF report.");
    } finally {
      setDownloadingAuditId(null);
    }
  };

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

  const historyDepartments = useMemo(
    () => [...new Set((audits.data || []).map((audit) => audit.department))].sort(),
    [audits.data]
  );

  const historyZones = useMemo(
    () => [...new Set((audits.data || []).map((audit) => audit.zone))].sort(),
    [audits.data]
  );

  const filteredAuditHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return (audits.data || []).filter((audit) => {
      const matchesSearch = !query || [audit.auditNumber, audit.zone, audit.department, audit.auditorName]
        .some((value) => value.toLowerCase().includes(query));
      const matchesDepartment = historyDepartment === "ALL" || audit.department === historyDepartment;
      const matchesZone = historyZone === "ALL" || audit.zone === historyZone;
      return matchesSearch && matchesDepartment && matchesZone;
    });
  }, [audits.data, historySearch, historyDepartment, historyZone]);

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

      const uploadResult = await apiUpload<UploadedPhoto>("/api/upload", formData);
      
      setChecklistResponses(prev => {
        const curr = prev[questionId] || { response: "Adequate" };
        const photos = curr.beforePhotos ? [...curr.beforePhotos] : [];
        photos.push({ secureUrl: uploadResult.secureUrl, publicId: uploadResult.publicId, sizeBytes: uploadResult.sizeBytes, uploadedBy: uploadResult.uploadedBy, uploadedByName: uploadResult.uploadedByName });
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
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">{historyOnly ? "Audit History" : newOnly ? "New 6S Audit" : "6S Site Audits"}</h1>
          <p className="mt-1 text-sm text-t2">
            {historyOnly
              ? "Review completed audits and download full PDF reports."
              : "Establish and verify workplace discipline and safety standards via systematic scoring audits."}
          </p>
        </div>
        {step === "history" && !historyOnly && (
          <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d" onClick={startAuditSetup}>
            <Plus size={16} /> Start Audit
          </button>
        )}
      </div>

      {/* STEP 1: HISTORY VIEW */}
      {step === "history" && (
        <div className={`grid grid-cols-1 gap-5 ${historyOnly ? "" : "md:grid-cols-[2fr_1fr]"}`}>
          {/* Audit History List */}
          <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold text-t1">Audit History</h2>
              <span className="text-xs text-t2">{filteredAuditHistory.length} audit{filteredAuditHistory.length === 1 ? "" : "s"}</span>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_190px_190px]">
              <input
                className="w-full rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                placeholder="Search audit number, zone, department, auditor..."
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
              <select
                className="w-full rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={historyDepartment}
                onChange={(event) => setHistoryDepartment(event.target.value)}
              >
                <option value="ALL">All Departments</option>
                {historyDepartments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
              <select
                className="w-full rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={historyZone}
                onChange={(event) => setHistoryZone(event.target.value)}
              >
                <option value="ALL">All Zones</option>
                {historyZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </div>
            {audits.loading ? (
              <div className="py-5 text-t2">Loading completed audits...</div>
            ) : !audits.data || audits.data.length === 0 ? (
              <div className="py-5 text-t2">No audits completed yet. Start your first site audit.</div>
            ) : filteredAuditHistory.length === 0 ? (
              <div className="py-5 text-center text-t2">No audits match the selected filters.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-bd bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Audit No</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Zone / Dept</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Auditor</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Score</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Date</th>
                      <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditHistory.map((audit) => {
                      const scoreBadge = scoreBadgeStyle(audit.totalScore);
                      return (
                      <tr key={audit._id}>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                          <strong>{audit.auditNumber}</strong>
                        </td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                          <div>{audit.zone}</div>
                          <span className="text-[11px] text-t2">{audit.department}</span>
                        </td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{audit.auditorName}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                          <span
                            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold"
                            style={{ background: scoreBadge.bg, color: scoreBadge.text, borderColor: scoreBadge.border }}
                          >
                            {audit.totalScore}%
                          </span>
                        </td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{new Date(audit.date).toLocaleDateString()}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-2.5 py-[5px] text-xs font-bold text-t1 hover:bg-bg3"
                              onClick={() => setSelectedAuditDetail(audit)}
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-brand bg-brand px-2.5 py-[5px] text-xs font-bold text-white hover:bg-brand-d disabled:cursor-wait disabled:opacity-60"
                              onClick={() => handleDownloadPdf(audit)}
                              disabled={downloadingAuditId === audit._id}
                            >
                              <Download size={12} /> {downloadingAuditId === audit._id ? "Creating..." : "PDF Report"}
                            </button>
                            {isUserAdmin && (
                              <button
                                className="inline-flex items-center gap-1 rounded-lg border border-red bg-white px-2.5 py-[5px] text-xs font-bold text-red hover:bg-bg3"
                                onClick={() => handleDeleteAudit(audit._id)}
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

          {/* Guidelines Box */}
          {!historyOnly && <div className="flex flex-col self-stretch rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2.5 font-extrabold text-t1">6S Scoring Guidelines</h2>
            <div className="grid gap-3 text-[13px]">
              <div className="rounded-lg border-l-4 border-l-brand bg-[#f8fafc] p-2.5">
                <strong>Multi-Step Checklist</strong>
                <p className="mt-1 text-t2">Audits cover 7 pillars: Sort, Set in Order, Shine, Standardize, Sustain, Safety, Environment.</p>
              </div>
              <div className="rounded-lg border-l-4 border-l-green bg-[#f8fafc] p-2.5">
                <strong>Scoring Metrics</strong>
                <p className="mt-1 text-t2">Adequate adds 1 point. Not Adequate adds 0 points and requires a description. N/A excludes the question.</p>
              </div>
              <div className="rounded-lg border-l-4 border-l-orange bg-[#f8fafc] p-2.5">
                <strong>CAPA Trigger</strong>
                <p className="mt-1 text-t2">Any finding marked "Not Adequate" instantly spawns an active CAPA ticket assigned to the department SPOC.</p>
              </div>
            </div>
          </div>}
        </div>
      )}

      {/* STEP 2: SETUP CONFIG */}
      {step === "setup" && (
        <div className="mx-auto my-5 max-w-[600px] rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-2.5 font-extrabold text-t1">Audit Configurations</h2>
          {setupError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{setupError}</div>}

          <div className="grid gap-4">
            <label className="mb-3 grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audit Zone</span>
              <select
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
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
              <div className="flex items-center gap-2.5 rounded-lg border border-bd bg-bg3 p-3">
                <MapPin size={16} className="text-t2" />
                <div>
                  <div className="text-[11px] font-bold uppercase text-t2">Target Department</div>
                  <strong>{selectedZone.department}</strong>
                </div>
              </div>
            )}

            <label className="mb-3 grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Lead Auditor</span>
              <select
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
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

            <label className="mb-3 grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audit Date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <div className="mt-2.5 flex justify-between">
              <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3" onClick={goToHistory}>Cancel</button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d" onClick={validateSetupAndStart}>
                Next: Start Checklist <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: INTERACTIVE CHECKLIST */}
      {step === "checklist" && masters.data && (
        <div className="grid gap-5">
          {/* Progress Header */}
          <div className="rounded-lg border border-bd bg-bg1 px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-extrabold">Audit Progress Checklist</span>
              <span className="text-sm text-t2">
                {answeredQuestionsCount} of {totalQuestionsCount} Answered ({completionPercentage}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-bg3">
              <div
                className="h-full bg-brand transition-[width] duration-300 ease-in-out"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Category Navigation Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat, idx) => {
              const stats = getCategoryStat(cat);
              const isSelected = currentCategoryIndex === idx;
              const isDone = stats.answered === stats.total;
              return (
                <button
                  key={cat}
                  onClick={() => setCurrentCategoryIndex(idx)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-bold ${
                    isSelected
                      ? "border-brand bg-accent text-brand-d"
                      : isDone
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-bd bg-white text-t1"
                  }`}
                >
                  {isDone && <Check size={14} className="mr-1" />}
                  {cat} ({stats.answered}/{stats.total})
                </button>
              );
            })}
          </div>

          {/* Question Work Area */}
          <div className="grid gap-6 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <div className="border-b border-bd pb-2.5">
              <h3 className="m-0 text-base uppercase text-brand">
                Pillar Category: {activeCategory}
              </h3>
            </div>

            {categoryQuestions.length === 0 ? (
              <div className="text-t2">No questions seeded for this category.</div>
            ) : (
              <div className="grid gap-5">
                {categoryQuestions.map((q, idx) => {
                  const state = checklistResponses[q._id];
                  const resp = state?.response;
                  return (
                    <div
                      key={q._id}
                      className={`grid gap-3 rounded-lg border p-4 ${
                        resp === "Adequate"
                          ? "border-green-200 bg-green-50"
                          : resp === "Not Adequate"
                          ? "border-red-200 bg-red-50"
                          : "border-bd bg-[#f8fafc]"
                      }`}
                    >
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                        <div>
                          <span className="mb-[3px] block text-[10px] font-black uppercase tracking-[0.06em] text-brand">
                            {q.subSection || "STANDARD"}
                          </span>
                          <strong className="text-[15px] leading-[1.4]">{idx + 1}. {q.text}</strong>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                          <button
                            onClick={() => setChecklistResponses(prev => ({
                              ...prev,
                              [q._id]: { ...prev[q._id], response: "Adequate" }
                            }))}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-bold ${
                              resp === "Adequate"
                                ? "border-green bg-green text-white"
                                : "border-bd bg-white text-t1"
                            }`}
                          >
                            Adequate
                          </button>
                          <button
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
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-bold ${
                              resp === "Not Adequate"
                                ? "border-red bg-red text-white"
                                : "border-bd bg-white text-t1"
                            }`}
                          >
                            Not Adequate
                          </button>
                          <button
                            onClick={() => setChecklistResponses(prev => ({
                              ...prev,
                              [q._id]: { ...prev[q._id], response: "N/A" }
                            }))}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-bold ${
                              resp === "N/A"
                                ? "border-t2 bg-t2 text-white"
                                : "border-bd bg-white text-t1"
                            }`}
                          >
                            N/A
                          </button>
                        </div>
                      </div>

                      {/* Not Adequate Inputs (Observation, Severity, Photos) */}
                      {resp === "Not Adequate" && (
                        <div className="mt-2 grid grid-cols-1 gap-3 border-t border-dashed border-red-300 pt-3.5 md:grid-cols-2">
                          <label className="col-span-1 mb-0 grid gap-1.5 md:col-span-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-d">Observation / Non-Conformity Description</span>
                            <textarea
                              className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                              rows={2}
                              placeholder="Describe the exact issue or standard deviation..."
                              value={state.observation || ""}
                              onChange={(e) => setChecklistResponses(prev => ({
                                ...prev,
                                [q._id]: { ...prev[q._id], observation: e.target.value }
                              }))}
                            />
                          </label>

                          <label className="mb-0 grid gap-1.5">
                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Finding Severity</span>
                            <select
                              className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
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

                          <div className="mb-0 grid gap-1.5">
                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audit Evidence (Before Photos)</span>
                            <div className="flex items-center gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-bd bg-white px-3 py-2 text-[13px] font-bold text-t1 hover:bg-bg3">
                                <UploadCloud size={16} className="text-t2" />
                                {uploading[q._id] ? "Uploading..." : "Upload Photo"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploading[q._id]}
                                  onChange={(e) => handlePhotoUpload(q._id, e)}
                                />
                              </label>
                            </div>
                          </div>

                          {/* Uploaded thumbnails */}
                          {state.beforePhotos && state.beforePhotos.length > 0 && (
                            <div className="col-span-1 mt-1 flex flex-wrap gap-2 md:col-span-2">
                              {state.beforePhotos.map((photo, pIdx) => (
                                <div
                                  key={photo.publicId}
                                  className="relative h-20 w-20 overflow-hidden rounded-md border border-bd"
                                >
                                  <img
                                    src={photo.secureUrl}
                                    alt="Evidence"
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    onClick={() => handleRemovePhoto(q._id, pIdx)}
                                    className="absolute top-0.5 right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border-0 bg-[rgba(220,38,38,0.9)] p-0 text-white"
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
          <div className="mt-2.5 flex items-center justify-between">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
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
                className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d"
                onClick={() => setCurrentCategoryIndex(prev => prev + 1)}
              >
                Next Category <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-55"
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
        <div className="mx-auto my-[30px] max-w-[600px] rounded-lg border border-bd bg-bg1 p-4 text-center shadow-[var(--shadow-sm)]">
          <div className="mb-4 text-green">
            <CheckCircle2 size={64} className="mx-auto" />
          </div>
          <h2 className="m-0 mb-2 text-2xl font-extrabold">Audit Submitted Successfully!</h2>
          <p className="mb-6 text-[15px] text-t2">
            Audit report <strong>{createdAudit.auditNumber}</strong> has been logged. Scores have been cascaded and department SPOCs notified.
          </p>

          <div className="mb-6 rounded-lg border border-bd bg-bg3 p-4 text-left">
            <div className="grid grid-cols-1 gap-2.5 text-sm md:grid-cols-2">
              <div>Zone: <strong>{createdAudit.zone}</strong></div>
              <div>Department: <strong>{createdAudit.department}</strong></div>
              <div>Auditor: <strong>{createdAudit.auditorName}</strong></div>
              <div>Total 6S Score: <strong className={createdAudit.totalScore >= 90 ? "text-green" : "text-brand"}>{createdAudit.totalScore}%</strong></div>
            </div>

            {createdFindings && createdFindings.length > 0 && (
              <div className="mt-4 border-t border-bd pt-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-red">
                  <AlertTriangle size={14} /> Created {createdFindings.length} Non-Conformity Findings:
                </div>
                <div className="grid gap-1.5">
                  {createdFindings.map((f) => {
                    const severityStyle = SEVERITY_BADGE_STYLES[f.severity as Severity] ?? SEVERITY_BADGE_STYLES.Low;
                    return (
                    <div key={f._id} className="flex justify-between rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[13px]">
                      <span><strong>{f.findingNumber}</strong>: {f.question}</span>
                      <span
                        className="inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-extrabold"
                        style={{ background: severityStyle.bg, color: severityStyle.text, borderColor: severityStyle.border }}
                      >
                        {f.severity}
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
              onClick={() => {
                if (!newOnly) setStep("history");
                setSelectedAuditDetail(createdAudit);
              }}
            >
              <Eye size={16} /> View Audit Report
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d"
              onClick={goToHistory}
            >
              Back to Audit History
            </button>
          </div>
        </div>
      )}

      {/* DETAIL DIALOG MODAL */}
      {selectedAuditDetail && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-[rgba(15,23,42,0.6)] p-5">
          <div className="relative w-full max-w-[800px] max-h-[90vh] overflow-y-auto rounded-lg border border-bd bg-bg1 p-6 shadow-[var(--shadow-sm)]">
            {/* Close Button */}
            <button
              onClick={() => { setSelectedAuditDetail(null); setIsShareOpen(false); setShareEmail(""); setShareMsg(""); }}
              className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-bd bg-white text-t2 shadow-[0_4px_14px_rgba(15,23,42,0.12)] hover:bg-bg3"
              aria-label="Close audit details"
            >
              <X size={20} />
            </button>

            <div className="mb-[18px] flex flex-wrap items-start justify-between gap-4 border-b border-bd pb-3.5 pr-12">
              <div>
                <span className="mb-1.5 inline-flex items-center rounded-full border border-red-200 bg-accent px-2.5 py-0.5 text-xs font-extrabold text-brand-d">COMPLETED REPORT</span>
                <h3 className="m-0 text-xl">Audit Details: {selectedAuditDetail.auditNumber}</h3>
                <span className="text-[13px] text-t2">
                  Performed on {new Date(selectedAuditDetail.date).toLocaleDateString()}
                </span>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold uppercase text-t2">Audit Score</div>
                <div className={`text-[32px] font-black ${selectedAuditDetail.totalScore >= 90 ? "text-green" : "text-brand"}`}>
                  {selectedAuditDetail.totalScore}%
                </div>
                <button
                  onClick={() => setIsShareOpen((prev) => !prev)}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-2.5 py-1.5 text-xs font-bold text-t1 hover:bg-bg3"
                >
                  <Mail size={13} /> Share Report
                </button>
                <button
                  onClick={() => handleDownloadPdf(selectedAuditDetail)}
                  disabled={downloadingAuditId === selectedAuditDetail._id}
                  className="mt-1.5 ml-1.5 inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-d disabled:cursor-wait disabled:opacity-60"
                >
                  <Download size={13} /> {downloadingAuditId === selectedAuditDetail._id ? "Creating PDF..." : "Download PDF"}
                </button>
              </div>
            </div>

            {isShareOpen && (
              <div className="mb-[18px] flex flex-wrap items-center gap-2 rounded-lg border border-bd bg-bg3 p-3">
                <input
                  type="email"
                  placeholder="recipient@company.com"
                  className="min-w-[220px] flex-1 rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                />
                <button
                  onClick={handleShareReport}
                  disabled={isSharing || !shareEmail.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-[.55]"
                >
                  {isSharing ? "Sending..." : "Send"}
                </button>
                {shareMsg && <span className="text-xs font-semibold text-t2">{shareMsg}</span>}
              </div>
            )}

            {/* Audit Info Card */}
            <div className="mb-[18px] grid grid-cols-1 gap-3 rounded-lg border border-bd bg-bg3 p-3 text-sm md:grid-cols-3">
              <div>
                <div className="text-[11px] text-t2">ZONE AREA</div>
                <strong>{selectedAuditDetail.zone}</strong>
              </div>
              <div>
                <div className="text-[11px] text-t2">DEPARTMENT</div>
                <strong>{selectedAuditDetail.department}</strong>
              </div>
              <div>
                <div className="text-[11px] text-t2">LEAD AUDITOR</div>
                <strong>{selectedAuditDetail.auditorName}</strong>
              </div>
            </div>

            {/* Category Pillars Breakdown */}
            <div className="mb-[18px]">
              <h4 className="m-0 mb-2 text-xs uppercase tracking-wide text-t2">
                Score breakdown by pillar
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(selectedAuditDetail.categoryScores || {}).map(([cat, score]) => (
                  <div key={cat} className="min-w-[90px] rounded-md border border-bd bg-[#f8fafc] px-3 py-2 text-center">
                    <div className="text-[10px] font-bold text-t2">{cat}</div>
                    <strong className="text-sm">{categoryScoreValue(score)}%</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist Details */}
            <div>
              <h4 className="m-0 mb-2.5 text-xs uppercase tracking-wide text-t2">
                Full Response checklist
              </h4>
              <div className="grid gap-2">
                {selectedAuditDetail.checklist.map((item, idx) => (
                  <div
                    key={item.questionId}
                    className={`rounded-md border p-3 ${
                      item.response === "Adequate"
                        ? "border-green-200 bg-green-50"
                        : item.response === "Not Adequate"
                        ? "border-red-200 bg-red-50"
                        : "border-bd bg-[#f8fafc]"
                    }`}
                  >
                    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_116px]">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase text-brand-d">
                          [{item.category}]
                        </span>
                        <div className="mt-0.5 text-[13px] font-bold">
                          {idx + 1}. {item.question}
                        </div>
                        {item.observation && (
                          <div className="mt-1 text-xs text-red">
                            <strong>Observation:</strong> {item.observation}
                          </div>
                        )}
                      </div>
                      <div className="flex w-[116px] shrink-0 flex-col items-stretch gap-1 justify-self-end">
                        <span
                          className={`inline-flex min-h-7 w-full items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-center text-[11px] font-extrabold leading-tight text-white ${responseBadgeClass(item.response)}`}
                        >
                          {item.response}
                        </span>
                        {item.severity && (() => {
                          const severityStyle = SEVERITY_BADGE_STYLES[item.severity as Severity] ?? SEVERITY_BADGE_STYLES.Low;
                          return (
                            <span
                              className="inline-flex min-h-6 w-full items-center justify-center rounded-full border px-2 py-0.5 text-center text-[10px] font-extrabold leading-tight"
                              style={{ background: severityStyle.bg, color: severityStyle.text, borderColor: severityStyle.border }}
                            >
                              {item.severity}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Photo attachments */}
                    {item.beforePhotos && item.beforePhotos.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {item.beforePhotos.map((p) => (
                          <a href={p.secureUrl} target="_blank" rel="noopener noreferrer" key={p.publicId}>
                            <img
                              src={p.secureUrl}
                              alt="Observation evidence"
                              className="h-10 w-10 rounded border border-bd object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
                onClick={() => setSelectedAuditDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Size / Compression Alert Modal */}
      {compressionAlert && (
        <div className="fixed inset-0 z-[100000] grid place-items-center bg-[rgba(15,23,42,0.6)] p-5 backdrop-blur-[4px]">
          <div className="flex w-full max-w-[420px] flex-col items-center gap-3.5 rounded-lg border border-bd bg-bg1 p-6 text-center shadow-[var(--shadow-sm)]">
            <div className="inline-flex rounded-full bg-[#fef9c3] p-3 text-[#eab308]">
              <AlertTriangle size={36} />
            </div>

            <div>
              <h3 className="m-0 mb-1.5 text-lg font-extrabold">Large File Warning</h3>
              <p className="m-0 text-sm leading-relaxed text-t2">
                The selected image is <strong>{compressionAlert.sizeMb} MB</strong>, which exceeds the recommended 3 MB limit. For optimal load speeds, please compress it first:
              </p>
            </div>

            <a
              href="https://imagecompressor.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] bg-[#f1f5f9] px-3.5 py-2.5 text-[13px] font-semibold text-[#0f172a] hover:bg-bg3"
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
