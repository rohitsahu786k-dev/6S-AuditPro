"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPatch, apiPost, apiUpload, useApi } from "@/hooks/useApi";
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
  Download,
  FileSpreadsheet,
  ClipboardList
} from "lucide-react";
import { defaultSeverity } from "@/lib/audit-scoring";
import { downloadAuditPdf } from "@/lib/audit-pdf";
import { processImageToWebP } from "@/utils/media";
import { scoreBadgeStyle, SEVERITY_BADGE_STYLES } from "@/lib/status-styles";
import type { Severity } from "@/types/domain";

type Masters = { 
  departments: Array<{ _id: string; name: string; isActive?: boolean }>;
  zones: Array<{ name: string; department: string }>; 
  questions: Array<{ _id: string; category: string; text: string; subSection: string; serialNumber?: number; sortOrder?: number }>;
  people: Array<{ _id: string; name: string; type: string; department?: string; isActive?: boolean }>;
  users: Array<{ _id: string; name: string; username: string; email?: string; department?: string; role: string; status?: string }>;
};

type Audit = { 
  _id: string; 
  auditNumber: string; 
  auditType?: "STANDARD" | "ADHOC";
  title?: string;
  description?: string;
  zone: string; 
  department: string; 
  auditorName: string; 
  totalScore: number; 
  date: string;
  startDate?: string | null;
  endDate?: string | null;
  // Absent on the history list, which omits the checklist to keep the response small.
  checklist?: Array<{
    questionId: string;
    sourceRowNumber?: number;
    importBatchId?: string;
    category: string;
    question: string;
    response: "Adequate" | "Not Adequate" | "N/A";
    observation?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
    actionOwnerId?: string;
    actionOwnerUserId?: string;
    actionOwnerName?: string;
    actionOwnerDepartment?: string;
    dueDate?: string;
    remarks?: string;
    beforePhotos?: Array<UploadedPhoto>;
  }>;
  categoryScores?: Record<string, number | { adequate: number; ownedNotAdequate?: number; total: number; na?: number; score: number }>;
  findingIds?: string[];
  adequateCount?: number;
  ownedNotAdequateCount?: number;
  applicableCount?: number;
  naCount?: number;
  importMetadata?: {
    originalFileName?: string;
    importedByName?: string;
    importedAt?: string;
    totalRows?: number;
    successfulRows?: number;
    failedRows?: number;
    importBatchId?: string;
    fileHash?: string;
  };
};

type FullAudit = Audit & { checklist: NonNullable<Audit["checklist"]> };

type CreateAuditResponse = {
  audit: Audit;
  findings?: Finding[];
};

function categoryScoreValue(score: number | { adequate?: number; total?: number; score?: number }): number {
  return typeof score === "object" && score !== null ? score.score ?? 0 : score;
}

type Finding = {
  _id: string;
  findingNumber: string;
  auditId?: string;
  auditNumber?: string;
  questionId?: string;
  question: string;
  category: string;
  severity: string;
  observation?: string;
  assignedTo?: string;
  department?: string;
  dueDate?: string;
  status?: string;
  capaStatus?: string;
  capaAction?: string;
  closureRemarks?: string;
  beforePhotos?: UploadedPhoto[];
  afterPhotos?: UploadedPhoto[];
};

type UploadedPhoto = { secureUrl: string; publicId: string; sizeBytes?: number; uploadedBy?: string; uploadedByName?: string };

type AdhocPreviewRow = {
  rowNumber: number;
  srNo: string;
  category: string;
  observation: string;
  assessment: "Adequate" | "Not Adequate" | "N/A" | "";
  responsibleDepartment: string;
  responsiblePerson: string;
  responsibleUserId?: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "";
  targetDate?: string;
  remarks: string;
  beforePhotos: UploadedPhoto[];
  validationStatus: "VALID" | "INVALID" | "WARNING";
  errors: string[];
  warnings: string[];
};

type AdhocPreview = {
  fileName: string;
  fileHash: string;
  importBatchId: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  adequateCount: number;
  notAdequateCount: number;
  naCount: number;
  invalidRows: number;
  scoreWarning?: string;
  rows: AdhocPreviewRow[];
};

function responseBadgeClass(response: "Adequate" | "Not Adequate" | "N/A") {
  if (response === "Adequate") return "bg-green";
  if (response === "Not Adequate") return "bg-red";
  return "bg-t2";
}

function formatAuditDate(value?: string | null) {
  if (!value) return "\u2014";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "\u2014" : date.toLocaleDateString();
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
}

function auditStartDate(audit: Audit) {
  return audit.startDate || audit.date || null;
}

function validateAdhocPreviewRow(row: AdhocPreviewRow, mastersData: Masters) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const activeDepartments = mastersData.departments.filter((department) => department.isActive !== false).map((department) => department.name);
  const activeUsers = mastersData.users.filter((portalUser) => portalUser.status !== "inactive");

  if (!row.category || !CATEGORIES.includes(row.category as any)) errors.push("Missing / invalid 6S Category");
  if (!row.observation.trim()) errors.push("Missing Observation");
  if (!row.assessment) errors.push("Missing Assessment");

  if (row.assessment === "Not Adequate") {
    if (!row.responsibleDepartment || !activeDepartments.includes(row.responsibleDepartment)) errors.push("Missing / unknown Responsible Department");
    if (!row.responsibleUserId) {
      errors.push("Missing Responsible Person");
    } else {
      const portalUser = activeUsers.find((item) => item._id === row.responsibleUserId);
      if (!portalUser) {
        errors.push("Unknown Responsible Person");
      } else if (row.responsibleDepartment && portalUser.department && portalUser.department !== row.responsibleDepartment) {
        errors.push("Responsible Person does not belong to selected department");
      }
    }
    if (!row.severity) errors.push("Missing Severity");
    if (!row.targetDate || Number.isNaN(new Date(row.targetDate).getTime())) errors.push("Missing / invalid Target Date");
  }

  if (row.assessment === "Not Adequate" && row.observation.trim().length > 0 && row.observation.trim().length < 3) {
    warnings.push("Observation is very short");
  }

  return {
    errors,
    warnings,
    validationStatus: errors.length ? "INVALID" as const : warnings.length ? "WARNING" as const : "VALID" as const
  };
}

function recalculateAdhocPreview(current: AdhocPreview, rows: AdhocPreviewRow[]): AdhocPreview {
  const adequateCount = rows.filter((row) => row.assessment === "Adequate").length;
  const notAdequateCount = rows.filter((row) => row.assessment === "Not Adequate").length;
  const naCount = rows.filter((row) => row.assessment === "N/A").length;
  const invalidRows = rows.filter((row) => row.errors.length > 0).length;
  return {
    ...current,
    rows,
    adequateCount,
    notAdequateCount,
    naCount,
    invalidRows,
    failedRows: invalidRows,
    successfulRows: rows.length - invalidRows,
    scoreWarning: adequateCount === 0 && notAdequateCount > 0
      ? "A proper 6S compliance score requires Adequate and Not Adequate assessment data. Please include all assessed checkpoints, not only negative observations."
      : undefined
  };
}

export function AuditWorkspace({ historyOnly = false, newOnly = false }: { historyOnly?: boolean; newOnly?: boolean }) {
  const router = useRouter();
  const masters = useApi<Masters>("/api/masters?view=lookup");
  const audits = useApi<Audit[]>("/api/audits?view=summary");
  const meApi = useApi<{ user: any | null }>("/api/auth/me");

  const currentUser = meApi.data?.user;
  const isUserAdmin = currentUser && ["MASTER_ADMIN", "ADMIN"].includes(currentUser.role);

  // Navigation & Step State ("New Audit" page jumps straight into the setup form)
  const [step, setStep] = useState<"history" | "auditType" | "setup" | "checklist" | "adhocDetails" | "adhocImport" | "success">(newOnly ? "auditType" : "history");

  // In newOnly mode the history list lives on /audit-history, so "back to
  // history" navigates there instead of switching the local step.
  function goToHistory() {
    if (newOnly) router.push("/audit-history");
    else setStep("history");
  }
  
  // Setup Form State
  const [zoneName, setZoneName] = useState("");
  const [auditorName, setAuditorName] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [setupError, setSetupError] = useState("");
  const [adhocTitle, setAdhocTitle] = useState("");
  const [adhocDescription, setAdhocDescription] = useState("");
  const [adhocPreview, setAdhocPreview] = useState<AdhocPreview | null>(null);
  const [adhocUploading, setAdhocUploading] = useState(false);
  const [adhocUploadError, setAdhocUploadError] = useState("");
  const [adhocFilterAssessment, setAdhocFilterAssessment] = useState("ALL");
  const [adhocFilterDepartment, setAdhocFilterDepartment] = useState("ALL");

  // Checklist State
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, {
    response: "Adequate" | "Not Adequate" | "N/A";
    observation?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
    actionOwnerId?: string;
    actionOwnerName?: string;
    actionOwnerDepartment?: string;
    beforePhotos?: Array<UploadedPhoto>;
  }>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Success Screen State
  const [createdAudit, setCreatedAudit] = useState<Audit | null>(null);
  const [createdFindings, setCreatedFindings] = useState<Finding[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal State
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<Audit | null>(null);
  const [auditDetailFindings, setAuditDetailFindings] = useState<Finding[]>([]);
  const [downloadingAuditId, setDownloadingAuditId] = useState<string | null>(null);
  const [isLoadingAuditDetail, setIsLoadingAuditDetail] = useState(false);
  const [isEditingAuditDates, setIsEditingAuditDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isSavingAuditDates, setIsSavingAuditDates] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDepartment, setHistoryDepartment] = useState("ALL");
  const [historyZone, setHistoryZone] = useState("ALL");
  const [historyAuditType, setHistoryAuditType] = useState("ALL");
  const [selectedHistoryAuditIds, setSelectedHistoryAuditIds] = useState<string[]>([]);
  const [isBulkHistoryActionRunning, setIsBulkHistoryActionRunning] = useState(false);

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

  // The history list omits the checklist, so anything that needs it loads the audit in full.
  async function fetchFullAudit(audit: Audit): Promise<FullAudit> {
    if (audit.checklist) return audit as FullAudit;
    const response = await fetch(`/api/audits/${audit._id}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load audit details");
    return json.data as FullAudit;
  }

  const handleDownloadPdf = async (audit: Audit) => {
    setDownloadingAuditId(audit._id);
    try {
      await downloadAuditPdf(await fetchFullAudit(audit));
    } catch (error) {
      alert(error instanceof Error ? `Unable to create PDF: ${error.message}` : "Unable to create PDF report.");
    } finally {
      setDownloadingAuditId(null);
    }
  };

  async function openAuditDetail(audit: Audit) {
    setSelectedAuditDetail(audit);
    setAuditDetailFindings([]);
    setEditStartDate(dateInputValue(auditStartDate(audit)));
    setEditEndDate(dateInputValue(audit.endDate));
    setIsEditingAuditDates(false);

    setIsLoadingAuditDetail(true);
    try {
      const fullAudit = await fetchFullAudit(audit);
      setSelectedAuditDetail(fullAudit);
      if ((fullAudit.auditType || "STANDARD") === "ADHOC") {
        const response = await fetch("/api/findings?view=full", { cache: "no-store" });
        const json = await response.json();
        if (response.ok && json.ok) {
          setAuditDetailFindings((json.data as Finding[]).filter((finding) =>
            finding.auditNumber === fullAudit.auditNumber || String(finding.auditId || "") === String(fullAudit._id)
          ));
        }
      }
    } catch (error) {
      alert(error instanceof Error ? `Unable to load audit details: ${error.message}` : "Unable to load audit details.");
    } finally {
      setIsLoadingAuditDetail(false);
    }
  }

  async function saveAuditDates() {
    if (!selectedAuditDetail) return;
    if (!editStartDate) {
      alert("Starting Date is required.");
      return;
    }
    if (editEndDate && new Date(editEndDate) < new Date(editStartDate)) {
      alert("Ending Date cannot be earlier than Starting Date.");
      return;
    }

    setIsSavingAuditDates(true);
    try {
      const updated = await apiPatch<Audit>(`/api/audits/${selectedAuditDetail._id}`, {
        startDate: editStartDate,
        endDate: editEndDate || null
      });
      setSelectedAuditDetail(updated);
      setEditStartDate(dateInputValue(auditStartDate(updated)));
      setEditEndDate(dateInputValue(updated.endDate));
      setIsEditingAuditDates(false);
      await audits.reload();
    } catch (err: any) {
      alert(`Failed to update audit dates: ${err.message}`);
    } finally {
      setIsSavingAuditDates(false);
    }
  }

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

  const actionOwnerOptions = useMemo(() => {
    if (!masters.data) return [];
    const options = new Map<string, { id: string; name: string; department: string; label: string }>();

    for (const person of masters.data.people) {
      if (person.type !== "RESPONSIBLE" || person.isActive === false) continue;
      const department = person.department && person.department !== "All" ? person.department : selectedZone?.department || "";
      if (!department) continue;
      const key = `person:${person._id}`;
      options.set(key, {
        id: person._id,
        name: person.name,
        department,
        label: `${person.name} (${department})`
      });
    }

    for (const department of masters.data.departments || []) {
      if (department.isActive === false) continue;
      const key = `department:${department.name}`;
      if (!options.has(key)) {
        options.set(key, {
          id: key,
          name: department.name,
          department: department.name,
          label: department.name
        });
      }
    }

    if (selectedZone?.department) {
      options.set(`area:${selectedZone.department}`, {
        id: `area:${selectedZone.department}`,
        name: "Respective Area Owner",
        department: selectedZone.department,
        label: `Respective Area Owner (${selectedZone.department})`
      });
    }

    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [masters.data, selectedZone?.department]);

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
      const matchesAuditType = historyAuditType === "ALL" || (audit.auditType || "STANDARD") === historyAuditType;
      return matchesSearch && matchesDepartment && matchesZone && matchesAuditType;
    });
  }, [audits.data, historySearch, historyDepartment, historyZone, historyAuditType]);

  const selectedHistoryAudits = useMemo(
    () => filteredAuditHistory.filter((audit) => selectedHistoryAuditIds.includes(audit._id)),
    [filteredAuditHistory, selectedHistoryAuditIds]
  );

  const allFilteredHistorySelected = filteredAuditHistory.length > 0
    && filteredAuditHistory.every((audit) => selectedHistoryAuditIds.includes(audit._id));

  function toggleHistoryAuditSelection(auditId: string) {
    setSelectedHistoryAuditIds((current) =>
      current.includes(auditId) ? current.filter((id) => id !== auditId) : [...current, auditId]
    );
  }

  function toggleAllFilteredHistorySelection() {
    setSelectedHistoryAuditIds((current) => {
      if (allFilteredHistorySelected) {
        const filteredIds = new Set(filteredAuditHistory.map((audit) => audit._id));
        return current.filter((id) => !filteredIds.has(id));
      }
      return [...new Set([...current, ...filteredAuditHistory.map((audit) => audit._id)])];
    });
  }

  const auditCategories = useMemo(() => {
    const categories = masters.data?.questions
      ? [...new Set(masters.data.questions.map((question) => question.category).filter(Boolean))]
      : [];
    return categories.length ? categories : [...CATEGORIES];
  }, [masters.data]);

  const activeCategory = auditCategories[currentCategoryIndex] || "";

  const categoryQuestions = useMemo(() => {
    if (!masters.data?.questions) return [];
    return masters.data.questions
      .filter((q) => q.category === activeCategory)
      .sort((a, b) => (a.serialNumber ?? a.sortOrder ?? 0) - (b.serialNumber ?? b.sortOrder ?? 0));
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
    resetAuditSetup();
    setChecklistResponses({});
    setCurrentCategoryIndex(0);
    setStep("auditType");
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
    if (!startDate) {
      setSetupError("Starting Date is required.");
      return;
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      setSetupError("Ending Date cannot be earlier than Starting Date.");
      return;
    }
    setSetupError("");
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

    const missingActionOwners = masters.data.questions.filter((q) => {
      const answer = checklistResponses[q._id];
      return answer?.response === "Not Adequate" && !answer.actionOwnerName;
    });
    if (missingActionOwners.length > 0) {
      alert(`Please assign an Action Owner for ${missingActionOwners.length} Not Adequate checkpoint${missingActionOwners.length === 1 ? "" : "s"} before submitting.`);
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
          actionOwnerId: answer.response === "Not Adequate" ? answer.actionOwnerId : undefined,
          actionOwnerName: answer.response === "Not Adequate" ? answer.actionOwnerName : undefined,
          actionOwnerDepartment: answer.response === "Not Adequate" ? answer.actionOwnerDepartment : undefined,
          beforePhotos: answer.response === "Not Adequate" ? answer.beforePhotos || [] : []
        };
      });

      const response = await apiPost<CreateAuditResponse>("/api/audits", {
        auditType: "STANDARD",
        zone: selectedZone?.name,
        department: selectedZone?.department,
        auditorName,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
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

  async function handleDownloadSelectedAuditPdfs() {
    if (selectedHistoryAudits.length === 0) return;
    setIsBulkHistoryActionRunning(true);
    try {
      for (const audit of selectedHistoryAudits) {
        await downloadAuditPdf(await fetchFullAudit(audit));
      }
    } catch (error) {
      alert(error instanceof Error ? `Unable to create selected PDF reports: ${error.message}` : "Unable to create selected PDF reports.");
    } finally {
      setIsBulkHistoryActionRunning(false);
    }
  }

  async function handleDeleteSelectedAudits() {
    if (selectedHistoryAudits.length === 0) return;
    const label = selectedHistoryAudits.map((audit) => audit.auditNumber).join(", ");
    if (!window.confirm(`Delete ${selectedHistoryAudits.length} selected audit${selectedHistoryAudits.length === 1 ? "" : "s"} (${label})? All associated findings and CAPA requests will be deleted permanently.`)) {
      return;
    }

    setIsBulkHistoryActionRunning(true);
    try {
      for (const audit of selectedHistoryAudits) {
        const response = await fetch(`/api/audits/${audit._id}`, { method: "DELETE" });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Delete failed for ${audit.auditNumber}`);
        }
      }
      alert("Selected audits deleted successfully.");
      setSelectedHistoryAuditIds([]);
      await audits.reload();
    } catch (err: any) {
      alert(`Error deleting selected audits: ${err.message}`);
    } finally {
      setIsBulkHistoryActionRunning(false);
    }
  }

  function resetAuditSetup() {
    setZoneName("");
    setAuditorName("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setSetupError("");
    setAdhocTitle("");
    setAdhocDescription("");
    setAdhocPreview(null);
    setAdhocUploadError("");
    setAdhocFilterAssessment("ALL");
    setAdhocFilterDepartment("ALL");
  }

  function startStandardAudit() {
    resetAuditSetup();
    setChecklistResponses({});
    setCurrentCategoryIndex(0);
    setStep("setup");
  }

  function startAdhocAudit() {
    resetAuditSetup();
    setStep("adhocDetails");
  }

  function validateAdhocDetailsAndContinue() {
    if (!adhocTitle.trim()) {
      setSetupError("Audit Title is required.");
      return;
    }
    if (!zoneName) {
      setSetupError("Please select an audited area / zone.");
      return;
    }
    if (!auditorName) {
      setSetupError("Please select or enter an auditor name.");
      return;
    }
    if (!startDate) {
      setSetupError("Starting Date is required.");
      return;
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      setSetupError("Ending Date cannot be earlier than Starting Date.");
      return;
    }
    setSetupError("");
    setStep("adhocImport");
  }

  async function downloadAdhocTemplate() {
    const response = await fetch("/api/audits/adhoc/template");
    if (!response.ok) {
      alert("Unable to download Adhoc template.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Adhoc-6S-Audit-Template.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function previewAdhocFile(file: File) {
    setAdhocUploading(true);
    setAdhocUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const preview = await apiUpload<AdhocPreview>("/api/audits/adhoc/preview", formData);
      setAdhocPreview(preview);
    } catch (err: any) {
      setAdhocPreview(null);
      setAdhocUploadError(err.message || "Unable to parse Excel file.");
    } finally {
      setAdhocUploading(false);
    }
  }

  function handleAdhocFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void previewAdhocFile(file);
    event.target.value = "";
  }

  function findingForAuditItem(item: NonNullable<Audit["checklist"]>[number]) {
    return auditDetailFindings.find((finding) =>
      (item.questionId && String((finding as any).questionId || "") === String(item.questionId)) ||
      (finding.category === item.category && finding.question === item.question)
    );
  }

  async function handleAdhocBeforePhotoUpload(item: NonNullable<Audit["checklist"]>[number], event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const finding = findingForAuditItem(item);
    if (!finding) {
      alert("Unable to find linked Finding for this observation.");
      return;
    }

    setUploading((prev) => ({ ...prev, [item.questionId]: true }));
    try {
      const processed = await processImageToWebP(file);
      const formData = new FormData();
      formData.append("file", processed.file);
      formData.append("folderSuffix", "audit-photos");
      const uploadResult = await apiUpload<UploadedPhoto>("/api/upload", formData);
      const beforePhotos = [
        ...(finding.beforePhotos || item.beforePhotos || []),
        { secureUrl: uploadResult.secureUrl, publicId: uploadResult.publicId, sizeBytes: uploadResult.sizeBytes, uploadedBy: uploadResult.uploadedBy, uploadedByName: uploadResult.uploadedByName }
      ];
      const updated = await apiPatch<Finding>(`/api/findings/${finding._id}`, { beforePhotos });
      setAuditDetailFindings((current) => current.map((row) => row._id === updated._id ? { ...row, ...updated, beforePhotos } : row));
      setSelectedAuditDetail((current) => current ? {
        ...current,
        checklist: current.checklist?.map((row) => row.questionId === item.questionId ? { ...row, beforePhotos } : row)
      } : current);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploading((prev) => ({ ...prev, [item.questionId]: false }));
    }
  }

  async function handleAdhocPreviewBeforePhotoUpload(rowIndex: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const uploadKey = `adhoc-preview-${rowIndex}`;
    setUploading((prev) => ({ ...prev, [uploadKey]: true }));
    try {
      const processed = await processImageToWebP(file);
      const formData = new FormData();
      formData.append("file", processed.file);
      formData.append("folderSuffix", "audit-photos");
      const uploadResult = await apiUpload<UploadedPhoto>("/api/upload", formData);
      updateAdhocRow(rowIndex, {
        beforePhotos: [
          ...(adhocPreview?.rows[rowIndex]?.beforePhotos || []),
          { secureUrl: uploadResult.secureUrl, publicId: uploadResult.publicId, sizeBytes: uploadResult.sizeBytes, uploadedBy: uploadResult.uploadedBy, uploadedByName: uploadResult.uploadedByName }
        ]
      });
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploading((prev) => ({ ...prev, [uploadKey]: false }));
    }
  }

  function removeAdhocPreviewBeforePhoto(rowIndex: number, photoPublicId: string) {
    updateAdhocRow(rowIndex, {
      beforePhotos: (adhocPreview?.rows[rowIndex]?.beforePhotos || []).filter((photo) => photo.publicId !== photoPublicId)
    });
  }

  function updateAdhocRow(index: number, patch: Partial<AdhocPreviewRow>) {
    setAdhocPreview((current) => {
      if (!current) return current;
      const rows = current.rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = { ...row, ...patch };
        if (!masters.data) return updated;
        return { ...updated, ...validateAdhocPreviewRow(updated, masters.data) };
      });
      return recalculateAdhocPreview(current, rows);
    });
  }

  async function submitAdhocAudit() {
    if (!masters.data || !selectedZone || !adhocPreview) return;
    const revalidatedRows = adhocPreview.rows.map((row) => ({ ...row, ...validateAdhocPreviewRow(row, masters.data!) }));
    const revalidatedPreview = recalculateAdhocPreview(adhocPreview, revalidatedRows);
    setAdhocPreview(revalidatedPreview);

    const invalidRows = revalidatedRows.filter((row) => row.errors.length > 0);
    if (invalidRows.length > 0) {
      const details = invalidRows.slice(0, 8).map((row) => `Row ${row.srNo || row.rowNumber}: ${row.errors.join(", ")}`).join("\n");
      const extra = invalidRows.length > 8 ? `\n...and ${invalidRows.length - 8} more row${invalidRows.length - 8 === 1 ? "" : "s"}.` : "";
      alert(`Please correct these required values before creating the Adhoc Audit:\n\n${details}${extra}`);
      return;
    }
    if (revalidatedPreview.adequateCount === 0 && revalidatedPreview.notAdequateCount > 0) {
      alert("A proper 6S compliance score requires Adequate and Not Adequate assessment data. Please include all assessed checkpoints, not only negative observations.");
      return;
    }

    setIsSubmitting(true);
    try {
      const checklistPayload = revalidatedRows.map((row, index) => ({
        questionId: `adhoc-${revalidatedPreview.importBatchId}-${row.srNo || index + 1}`,
        sourceRowNumber: row.rowNumber,
        importBatchId: revalidatedPreview.importBatchId,
        category: row.category,
        question: row.observation,
        response: row.assessment,
        observation: row.remarks,
        severity: row.assessment === "Not Adequate" ? row.severity || "Medium" : undefined,
        actionOwnerId: row.responsibleUserId,
        actionOwnerUserId: row.responsibleUserId,
        actionOwnerName: row.responsiblePerson,
        actionOwnerDepartment: row.responsibleDepartment,
        dueDate: row.targetDate ? new Date(row.targetDate) : undefined,
        remarks: row.remarks,
        beforePhotos: row.assessment === "Not Adequate" ? row.beforePhotos || [] : []
      }));

      const response = await apiPost<CreateAuditResponse>("/api/audits", {
        auditType: "ADHOC",
        title: adhocTitle.trim(),
        description: adhocDescription.trim(),
        zone: selectedZone.name,
        department: selectedZone.department,
        auditorName,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        checklist: checklistPayload,
        importMetadata: {
          originalFileName: revalidatedPreview.fileName,
          totalRows: revalidatedPreview.totalRows,
          successfulRows: revalidatedPreview.successfulRows,
          failedRows: revalidatedPreview.failedRows,
          importBatchId: revalidatedPreview.importBatchId,
          fileHash: revalidatedPreview.fileHash
        }
      });

      setCreatedAudit(response.audit);
      setCreatedFindings(response.findings || []);
      setStep("success");
      await audits.reload();
    } catch (err: any) {
      alert(`Failed to create Adhoc Audit: ${err.message}`);
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

      {step === "auditType" && (
        <div className="mx-auto grid max-w-[860px] gap-4 md:grid-cols-2">
          <button
            className="group flex min-h-[190px] flex-col items-start justify-between rounded-lg border border-bd bg-bg1 p-5 text-left shadow-[var(--shadow-sm)] hover:border-brand"
            onClick={startStandardAudit}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-d">
              <ClipboardList size={22} />
            </span>
            <div>
              <div className="mb-1 text-lg font-extrabold text-t1">Standard Audit</div>
              <p className="text-sm text-t2">Audit using the predefined 6S checklist.</p>
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wide text-brand-d">Use fixed checklist</span>
          </button>
          <button
            className="group flex min-h-[190px] flex-col items-start justify-between rounded-lg border border-bd bg-bg1 p-5 text-left shadow-[var(--shadow-sm)] hover:border-brand"
            onClick={startAdhocAudit}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef6ff] text-[#1d4ed8]">
              <FileSpreadsheet size={22} />
            </span>
            <div>
              <div className="mb-1 text-lg font-extrabold text-t1">Adhoc Audit</div>
              <p className="text-sm text-t2">Create a flexible 6S audit by importing observations from Excel.</p>
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#1d4ed8]">Import Excel assessment</span>
          </button>
          <div className="md:col-span-2">
            <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3" onClick={goToHistory}>
              <ChevronLeft size={16} /> Back
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: HISTORY VIEW */}
      {step === "history" && (
        <div className={`grid grid-cols-1 gap-5 ${historyOnly ? "" : "md:grid-cols-[2fr_1fr]"}`}>
          {/* Audit History List */}
          <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold text-t1">Audit History</h2>
              <span className="text-xs text-t2">{filteredAuditHistory.length} audit{filteredAuditHistory.length === 1 ? "" : "s"}</span>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_160px_150px]">
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
              <select
                className="w-full rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={historyAuditType}
                onChange={(event) => setHistoryAuditType(event.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="STANDARD">Standard</option>
                <option value="ADHOC">Adhoc</option>
              </select>
            </div>
            {filteredAuditHistory.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bd bg-bg3 px-3 py-2">
                <span className="text-xs font-semibold text-t2">
                  {selectedHistoryAudits.length} selected
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-brand bg-white px-2.5 py-1.5 text-xs font-bold text-brand hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleDownloadSelectedAuditPdfs}
                    disabled={selectedHistoryAudits.length === 0 || isBulkHistoryActionRunning}
                  >
                    <Download size={12} /> PDF Selected
                  </button>
                  {isUserAdmin && (
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-red bg-white px-2.5 py-1.5 text-xs font-bold text-red hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleDeleteSelectedAudits}
                      disabled={selectedHistoryAudits.length === 0 || isBulkHistoryActionRunning}
                    >
                      <Trash2 size={12} /> Delete Selected
                    </button>
                  )}
                </div>
              </div>
            )}
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
                      <th className="w-10 bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-bd"
                          checked={allFilteredHistorySelected}
                          onChange={toggleAllFilteredHistorySelection}
                          aria-label="Select all filtered audits"
                        />
                      </th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Audit No</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Type</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Starting Date</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Ending Date</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Zone / Dept</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Auditor</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Score</th>
                      <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditHistory.map((audit) => {
                      const scoreBadge = scoreBadgeStyle(audit.totalScore);
                      return (
                      <tr key={audit._id}>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-bd"
                            checked={selectedHistoryAuditIds.includes(audit._id)}
                            onChange={() => toggleHistoryAuditSelection(audit._id)}
                            aria-label={`Select audit ${audit.auditNumber}`}
                          />
                        </td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                          <strong>{audit.auditNumber}</strong>
                          {audit.title && <div className="mt-0.5 max-w-[180px] truncate text-[11px] font-semibold text-t2">{audit.title}</div>}
                        </td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${((audit.auditType || "STANDARD") === "ADHOC") ? "border-blue-200 bg-blue-50 text-blue-700" : "border-bd bg-bg3 text-t2"}`}>
                            {(audit.auditType || "STANDARD") === "ADHOC" ? "Adhoc" : "Standard"}
                          </span>
                        </td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{formatAuditDate(auditStartDate(audit))}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{formatAuditDate(audit.endDate)}</td>
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
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-2.5 py-[5px] text-xs font-bold text-t1 hover:bg-bg3"
                              onClick={() => openAuditDetail(audit)}
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

      {step === "adhocDetails" && (
        <div className="mx-auto my-5 max-w-[760px] rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-brand" />
            <h2 className="font-extrabold text-t1">Adhoc Audit Details</h2>
          </div>
          {setupError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{setupError}</div>}

          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audit Title</span>
              <input
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={adhocTitle}
                onChange={(event) => setAdhocTitle(event.target.value)}
                placeholder="Example: Line 2 Special 6S Audit"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audited Area / Zone</span>
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
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Auditor</span>
                <select
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                >
                  <option value="">Select Auditor</option>
                  {auditors.map((p) => (
                    <option key={p._id} value={p.name}>{p.name}</option>
                  ))}
                  <option value={currentUser?.name || "Lead Auditor"}>{currentUser?.name || "Lead Auditor"}</option>
                </select>
              </label>
            </div>

            {selectedZone && (
              <div className="flex items-center gap-2.5 rounded-lg border border-bd bg-bg3 p-3">
                <MapPin size={16} className="text-t2" />
                <div>
                  <div className="text-[11px] font-bold uppercase text-t2">Audited Department</div>
                  <strong>{selectedZone.department}</strong>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Starting Date</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Ending Date</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Description / Remarks</span>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={adhocDescription}
                onChange={(event) => setAdhocDescription(event.target.value)}
                placeholder="Scope, reason, area context, or special audit remarks..."
              />
            </label>

            <div className="mt-2.5 flex justify-between">
              <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3" onClick={() => setStep("auditType")}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d" onClick={validateAdhocDetailsAndContinue}>
                Next: Excel Import <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "adhocImport" && (
        <div className="grid gap-5">
          <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700">
                  <FileSpreadsheet size={13} /> ADHOC AUDIT
                </div>
                <h2 className="font-extrabold text-t1">Excel Template / Upload</h2>
                <p className="mt-1 max-w-3xl text-sm text-t2">
                  Use one row per assessed checkpoint or observation. Select Adequate, Not Adequate or N/A for every row. Not Adequate rows will automatically create Findings and enter the CAPA workflow.
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
                onClick={downloadAdhocTemplate}
              >
                <Download size={16} /> Download Template
              </button>
            </div>

            <label
              className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-t2 bg-bg3 px-4 py-6 text-center hover:border-brand"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void previewAdhocFile(file);
              }}
            >
              <UploadCloud size={28} className="mb-2 text-t2" />
              <strong className="text-sm text-t1">{adhocUploading ? "Parsing Excel..." : "Drag and drop Excel here"}</strong>
              <span className="mt-1 text-xs text-t2">or browse a .xlsx / .xls file up to 5 MB</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={adhocUploading} onChange={handleAdhocFileInput} />
            </label>

            {adhocUploadError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red">{adhocUploadError}</div>}
          </div>

          {adhocPreview && (
            <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-t1">Import Preview</h2>
                  <p className="mt-1 text-sm text-t2">{adhocPreview.fileName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                  <div className="rounded-md border border-bd bg-bg3 px-3 py-2"><div className="text-[10px] font-bold text-t2">Rows</div><strong>{adhocPreview.totalRows}</strong></div>
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2"><div className="text-[10px] font-bold text-green">Adequate</div><strong>{adhocPreview.adequateCount}</strong></div>
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2"><div className="text-[10px] font-bold text-red">Not Adequate</div><strong>{adhocPreview.notAdequateCount}</strong></div>
                  <div className="rounded-md border border-bd bg-[#f8fafc] px-3 py-2"><div className="text-[10px] font-bold text-t2">N/A</div><strong>{adhocPreview.naCount}</strong></div>
                  <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2"><div className="text-[10px] font-bold text-orange">Invalid</div><strong>{adhocPreview.invalidRows}</strong></div>
                </div>
              </div>

              {adhocPreview.scoreWarning && (
                <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-[13px] font-semibold text-orange">{adhocPreview.scoreWarning}</div>
              )}

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[180px_220px_1fr]">
                <select className="rounded-lg border border-bd px-3 py-2 text-sm" value={adhocFilterAssessment} onChange={(event) => setAdhocFilterAssessment(event.target.value)}>
                  <option value="ALL">All Assessments</option>
                  <option value="Adequate">Adequate</option>
                  <option value="Not Adequate">Not Adequate</option>
                  <option value="N/A">N/A</option>
                </select>
                <select className="rounded-lg border border-bd px-3 py-2 text-sm" value={adhocFilterDepartment} onChange={(event) => setAdhocFilterDepartment(event.target.value)}>
                  <option value="ALL">All Responsible Departments</option>
                  {masters.data?.departments.filter((department) => department.isActive !== false).map((department) => (
                    <option key={department.name} value={department.name}>{department.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2 text-sm font-bold text-t1 hover:bg-bg3" onClick={() => setStep("adhocDetails")}>
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={submitAdhocAudit}
                    disabled={isSubmitting}
                  >
                    <Check size={16} /> {isSubmitting ? "Creating..." : "Create Adhoc Audit"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-bd bg-white">
                <table className="w-full min-w-[1320px] border-collapse text-xs">
                  <thead>
                    <tr>
                      {["Sr", "Category", "Observation", "Assessment", "Resp. Department", "Responsible Person", "Severity", "Target Date", "Validation", "Before Upload"].map((head) => (
                        <th key={head} className="bg-bg3 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-t2">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adhocPreview.rows
                      .map((row, originalIndex) => ({ row, originalIndex }))
                      .filter(({ row }) => adhocFilterAssessment === "ALL" || row.assessment === adhocFilterAssessment)
                      .filter(({ row }) => adhocFilterDepartment === "ALL" || row.responsibleDepartment === adhocFilterDepartment)
                      .map(({ row, originalIndex }) => {
                        const rowInvalid = row.errors.length > 0;
                        const userOptions = (masters.data?.users || []).filter((portalUser) =>
                          portalUser.status !== "inactive" &&
                          (!row.responsibleDepartment || !portalUser.department || portalUser.department === row.responsibleDepartment)
                        );
                        return (
                          <tr key={`${row.rowNumber}-${originalIndex}`} className={rowInvalid ? "bg-red-50" : ""}>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">{row.srNo}</td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <select className="w-36 rounded border border-bd px-2 py-1" value={row.category} onChange={(event) => updateAdhocRow(originalIndex, { category: event.target.value })}>
                                <option value="">Select</option>
                                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                              </select>
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <textarea className="h-16 w-72 rounded border border-bd px-2 py-1" value={row.observation} onChange={(event) => updateAdhocRow(originalIndex, { observation: event.target.value })} />
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <select className="w-32 rounded border border-bd px-2 py-1" value={row.assessment} onChange={(event) => updateAdhocRow(originalIndex, { assessment: event.target.value as AdhocPreviewRow["assessment"] })}>
                                <option value="">Select</option>
                                <option value="Adequate">Adequate</option>
                                <option value="Not Adequate">Not Adequate</option>
                                <option value="N/A">N/A</option>
                              </select>
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <select className="w-44 rounded border border-bd px-2 py-1" value={row.responsibleDepartment} onChange={(event) => updateAdhocRow(originalIndex, { responsibleDepartment: event.target.value, responsibleUserId: undefined, responsiblePerson: "" })}>
                                <option value="">Select</option>
                                {masters.data?.departments.filter((department) => department.isActive !== false).map((department) => <option key={department.name} value={department.name}>{department.name}</option>)}
                              </select>
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <select
                                className="w-56 rounded border border-bd px-2 py-1"
                                value={row.responsibleUserId || ""}
                                onChange={(event) => {
                                  const portalUser = masters.data?.users.find((item) => item._id === event.target.value);
                                  updateAdhocRow(originalIndex, {
                                    responsibleUserId: portalUser?._id,
                                    responsiblePerson: portalUser?.name || "",
                                    responsibleDepartment: portalUser?.department || row.responsibleDepartment
                                  });
                                }}
                              >
                                <option value="">Select Portal User</option>
                                {userOptions.map((portalUser) => <option key={portalUser._id} value={portalUser._id}>{portalUser.name} ({portalUser.department || "No department"})</option>)}
                              </select>
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <select className="w-28 rounded border border-bd px-2 py-1" value={row.severity} onChange={(event) => updateAdhocRow(originalIndex, { severity: event.target.value as AdhocPreviewRow["severity"] })}>
                                <option value="">Select</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <input className="w-36 rounded border border-bd px-2 py-1" type="date" value={dateInputValue(row.targetDate)} onChange={(event) => updateAdhocRow(originalIndex, { targetDate: event.target.value ? new Date(event.target.value).toISOString() : undefined })} />
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${rowInvalid ? "border-red-200 bg-red-50 text-red" : "border-green-200 bg-green-50 text-green"}`}>
                                {rowInvalid ? "Invalid" : "Valid"}
                              </span>
                              {(row.errors.length > 0 || row.warnings.length > 0) && (
                                <div className="mt-1 max-w-[220px] text-[11px] text-red">{[...row.errors, ...row.warnings].join(", ")}</div>
                              )}
                            </td>
                            <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                              {row.assessment === "Not Adequate" ? (
                                <div className="grid gap-1.5">
                                  {(row.beforePhotos || []).length > 0 && (
                                    <div className="flex max-w-[180px] flex-wrap gap-1">
                                      {(row.beforePhotos || []).map((photo) => (
                                        <div key={photo.publicId} className="relative h-10 w-10">
                                          <a href={photo.secureUrl} target="_blank" rel="noopener noreferrer">
                                            <img src={photo.secureUrl} alt="Before upload" className="h-10 w-10 rounded border border-bd object-cover" />
                                          </a>
                                          <button
                                            type="button"
                                            className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-red bg-white text-red shadow-sm"
                                            onClick={() => removeAdhocPreviewBeforePhoto(originalIndex, photo.publicId)}
                                            title="Remove before photo"
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-lg border border-bd bg-white px-2 py-1 text-[11px] font-bold text-t1 hover:bg-bg3">
                                    <UploadCloud size={12} /> {uploading[`adhoc-preview-${originalIndex}`] ? "Uploading" : (row.beforePhotos || []).length ? "Add More" : "Upload"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      disabled={uploading[`adhoc-preview-${originalIndex}`]}
                                      onChange={(event) => handleAdhocPreviewBeforePhotoUpload(originalIndex, event)}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <span className="text-[11px] text-t2">Not required</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Starting Date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </label>

            <label className="mb-3 grid gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Ending Date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
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
            {auditCategories.map((cat, idx) => {
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
                                  observation: prev[q._id]?.observation || "",
                                  actionOwnerId: prev[q._id]?.actionOwnerId || "",
                                  actionOwnerName: prev[q._id]?.actionOwnerName || "",
                                  actionOwnerDepartment: prev[q._id]?.actionOwnerDepartment || ""
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

                          <label className="mb-0 grid gap-1.5">
                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Action Owner</span>
                            <select
                              className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                              value={state.actionOwnerId || ""}
                              onChange={(e) => {
                                const owner = actionOwnerOptions.find((option) => option.id === e.target.value);
                                setChecklistResponses(prev => ({
                                  ...prev,
                                  [q._id]: {
                                    ...prev[q._id],
                                    actionOwnerId: owner?.id || "",
                                    actionOwnerName: owner?.name || "",
                                    actionOwnerDepartment: owner?.department || ""
                                  }
                                }));
                              }}
                            >
                              <option value="">Select Action Owner...</option>
                              {actionOwnerOptions.map((owner) => (
                                <option key={owner.id} value={owner.id}>{owner.label}</option>
                              ))}
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

            {currentCategoryIndex < auditCategories.length - 1 ? (
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
              <div>Starting Date: <strong>{formatAuditDate(auditStartDate(createdAudit))}</strong></div>
              <div>Ending Date: <strong>{formatAuditDate(createdAudit.endDate)}</strong></div>
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
                      <span>
                        <strong>{f.findingNumber}</strong>: {f.question}
                        {f.assignedTo && (
                          <span className="ml-1 text-[11px] font-semibold text-t2">Owner: {f.assignedTo}</span>
                        )}
                      </span>
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
                openAuditDetail(createdAudit);
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
              onClick={() => { setSelectedAuditDetail(null); setIsShareOpen(false); setShareEmail(""); setShareMsg(""); setIsEditingAuditDates(false); }}
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
                  Starting Date: {formatAuditDate(auditStartDate(selectedAuditDetail))} | Ending Date: {formatAuditDate(selectedAuditDetail.endDate)}
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
                <div className="text-[11px] text-t2">STARTING DATE</div>
                <strong>{formatAuditDate(auditStartDate(selectedAuditDetail))}</strong>
              </div>
              <div>
                <div className="text-[11px] text-t2">ENDING DATE</div>
                <strong>{formatAuditDate(selectedAuditDetail.endDate)}</strong>
              </div>
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

            {isUserAdmin && (
              <div className="mb-[18px] rounded-lg border border-bd bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="m-0 text-xs uppercase tracking-wide text-t2">Audit Dates</h4>
                  {!isEditingAuditDates && (
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-2.5 py-[5px] text-xs font-bold text-t1 hover:bg-bg3"
                      onClick={() => {
                        setEditStartDate(dateInputValue(auditStartDate(selectedAuditDetail)));
                        setEditEndDate(dateInputValue(selectedAuditDetail.endDate));
                        setIsEditingAuditDates(true);
                      }}
                    >
                      Edit Dates
                    </button>
                  )}
                </div>
                {isEditingAuditDates ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="grid gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Starting Date</span>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                        value={editStartDate}
                        onChange={(event) => setEditStartDate(event.target.value)}
                        required
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Ending Date</span>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-bd px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                        value={editEndDate}
                        min={editStartDate || undefined}
                        onChange={(event) => setEditEndDate(event.target.value)}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-brand bg-brand px-2.5 py-2 text-xs font-bold text-white hover:bg-brand-d disabled:cursor-wait disabled:opacity-60"
                        onClick={saveAuditDates}
                        disabled={isSavingAuditDates}
                      >
                        {isSavingAuditDates ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-2.5 py-2 text-xs font-bold text-t1 hover:bg-bg3"
                        onClick={() => setIsEditingAuditDates(false)}
                        disabled={isSavingAuditDates}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>Starting Date: <strong>{formatAuditDate(auditStartDate(selectedAuditDetail))}</strong></div>
                    <div>Ending Date: <strong>{formatAuditDate(selectedAuditDetail.endDate)}</strong></div>
                  </div>
                )}
              </div>
            )}

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

            {(selectedAuditDetail.auditType || "STANDARD") === "ADHOC" && (
              <div className="mb-[18px] grid gap-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-blue-700">ADHOC AUDIT</span>
                      <h4 className="mt-2 text-base font-extrabold text-t1">{selectedAuditDetail.title || "Adhoc 6S Audit"}</h4>
                      {selectedAuditDetail.description && <p className="mt-1 text-sm text-t2">{selectedAuditDetail.description}</p>}
                    </div>
                    <div className="text-right text-xs text-t2">
                      <div>Imported File</div>
                      <strong className="text-t1">{selectedAuditDetail.importMetadata?.originalFileName || "Excel import"}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-6">
                    <div className="rounded-md border border-bd bg-white px-3 py-2"><div className="text-[10px] font-bold text-t2">Score</div><strong>{selectedAuditDetail.totalScore}%</strong></div>
                    <div className="rounded-md border border-green-200 bg-white px-3 py-2"><div className="text-[10px] font-bold text-green">Adequate</div><strong>{selectedAuditDetail.adequateCount ?? selectedAuditDetail.checklist?.filter((item) => item.response === "Adequate").length ?? 0}</strong></div>
                    <div className="rounded-md border border-red-200 bg-white px-3 py-2"><div className="text-[10px] font-bold text-red">Not Adeq.</div><strong>{selectedAuditDetail.checklist?.filter((item) => item.response === "Not Adequate").length ?? 0}</strong></div>
                    <div className="rounded-md border border-bd bg-white px-3 py-2"><div className="text-[10px] font-bold text-t2">N/A</div><strong>{selectedAuditDetail.naCount ?? selectedAuditDetail.checklist?.filter((item) => item.response === "N/A").length ?? 0}</strong></div>
                    <div className="rounded-md border border-orange-200 bg-white px-3 py-2"><div className="text-[10px] font-bold text-orange">Open</div><strong>{auditDetailFindings.filter((finding) => finding.status !== "CLOSED").length}</strong></div>
                    <div className="rounded-md border border-green-200 bg-white px-3 py-2"><div className="text-[10px] font-bold text-green">Closure %</div><strong>{auditDetailFindings.length ? Math.round((auditDetailFindings.filter((finding) => finding.status === "CLOSED").length / auditDetailFindings.length) * 100) : 0}%</strong></div>
                  </div>
                </div>

                <div>
                  <h4 className="m-0 mb-2.5 text-xs uppercase tracking-wide text-t2">
                    Imported Observations
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-bd bg-white">
                    <table className="w-full min-w-[1120px] border-collapse text-xs">
                      <thead>
                        <tr>
                          {["Sr", "Category", "Observation", "Assessment", "Responsible", "Severity", "Due Date", "Before Evidence", "CAPA / After", "Finding"].map((head) => (
                            <th key={head} className="bg-bg3 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-t2">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedAuditDetail.checklist || []).map((item, index) => {
                          const finding = findingForAuditItem(item);
                          const beforePhotos = finding?.beforePhotos?.length ? finding.beforePhotos : item.beforePhotos || [];
                          const afterPhotos = finding?.afterPhotos || [];
                          return (
                            <tr key={item.questionId || index}>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">{item.sourceRowNumber || index + 1}</td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top font-semibold">{item.category}</td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                                <div className="max-w-[280px] font-semibold text-t1">{item.question}</div>
                                {(item.remarks || item.observation) && <div className="mt-1 max-w-[280px] text-[11px] text-t2">{item.remarks || item.observation}</div>}
                              </td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${responseBadgeClass(item.response)}`}>{item.response}</span>
                              </td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                                <div>{item.actionOwnerName || "-"}</div>
                                <span className="text-[11px] text-t2">{item.actionOwnerDepartment || "-"}</span>
                              </td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">{item.severity || "-"}</td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">{formatAuditDate(item.dueDate)}</td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                                {item.response === "Not Adequate" && (
                                  <div className="grid gap-1.5">
                                    <div className="flex flex-wrap gap-1">
                                      {beforePhotos.map((photo) => (
                                        <a href={photo.secureUrl} target="_blank" rel="noopener noreferrer" key={photo.publicId}>
                                          <img src={photo.secureUrl} alt="Before evidence" className="h-10 w-10 rounded border border-bd object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                    <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-lg border border-bd bg-white px-2 py-1 text-[11px] font-bold text-t1 hover:bg-bg3">
                                      <UploadCloud size={12} /> {uploading[item.questionId] ? "Uploading" : beforePhotos.length ? "Add / Replace" : "Upload"}
                                      <input type="file" accept="image/*" className="hidden" disabled={uploading[item.questionId]} onChange={(event) => handleAdhocBeforePhotoUpload(item, event)} />
                                    </label>
                                  </div>
                                )}
                              </td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                                {finding ? (
                                  <div className="max-w-[220px]">
                                    <div className="font-semibold">{finding.capaStatus || "NOT_SUBMITTED"}</div>
                                    <div className="mt-1 text-[11px] text-t2">{finding.capaAction || "CAPA pending"}</div>
                                    {afterPhotos.length > 0 && (
                                      <div className="mt-1 flex gap-1">
                                        {afterPhotos.map((photo) => (
                                          <a href={photo.secureUrl} target="_blank" rel="noopener noreferrer" key={photo.publicId}>
                                            <img src={photo.secureUrl} alt="After evidence" className="h-10 w-10 rounded border border-bd object-cover" />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : item.response === "Not Adequate" ? "Finding not linked" : "-"}
                              </td>
                              <td className="border-b border-[#edf0f4] px-2 py-2 align-top">
                                {finding ? (
                                  <div>
                                    <strong>{finding.findingNumber}</strong>
                                    <div className="mt-1 text-[11px] text-t2">{finding.status || "OPEN"}</div>
                                  </div>
                                ) : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Details */}
            {(selectedAuditDetail.auditType || "STANDARD") !== "ADHOC" && <div>
              <h4 className="m-0 mb-2.5 text-xs uppercase tracking-wide text-t2">
                Full Response checklist
              </h4>
              <div className="grid gap-2">
                {!selectedAuditDetail.checklist && (
                  <div className="rounded-md border border-bd bg-bg3 p-3 text-sm text-t2">
                    {isLoadingAuditDetail ? "Loading checklist..." : "Checklist unavailable."}
                  </div>
                )}
                {(selectedAuditDetail.checklist || []).map((item, idx) => (
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
                        {item.actionOwnerName && (
                          <div className="mt-1 text-xs text-t2">
                            <strong>Action Owner:</strong> {item.actionOwnerName}
                            {item.actionOwnerDepartment ? ` (${item.actionOwnerDepartment})` : ""}
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
            </div>}

            <div className="mt-5 flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
                onClick={() => { setSelectedAuditDetail(null); setIsEditingAuditDates(false); }}
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
