"use client";

import { useMemo, useState } from "react";
import { apiUpload, useApi } from "@/hooks/useApi";
import {
  Search,
  Trash2,
  UploadCloud,
  X,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  FolderOpen,
  Download
} from "lucide-react";
import { processImageToWebP } from "@/utils/media";

type MediaItem = {
  id: string;
  url: string;
  publicId: string;
  type: "BEFORE" | "AFTER" | "AUDIT";
  sourceId: string;
  sourceNumber: string;
  category: string;
  zone: string;
  department: string;
  date: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  assignedTo?: string;
  uploadedByName?: string;
  sizeBytes?: number;
};

type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "MASTER_ADMIN" | "ADMIN" | "AUDITOR" | "SPOC" | "MANAGEMENT";
  department?: string;
};

type Masters = {
  zones: Array<{ name: string; department: string }>;
  departments: Array<{ name: string; manager: string }>;
};

type Finding = {
  _id: string;
  findingNumber: string;
  question: string;
  zone: string;
  department: string;
  category: string;
  status: string;
  beforePhotos: Array<{ secureUrl: string; publicId: string }>;
  afterPhotos: Array<{ secureUrl: string; publicId: string }>;
};

type UploadedPhoto = { secureUrl: string; publicId: string; sizeBytes?: number; uploadedBy?: string; uploadedByName?: string };

export function MediaWorkspace() {
  const mediaApi = useApi<MediaItem[]>("/api/media");
  const meApi = useApi<{ user: SessionUser | null }>("/api/auth/me");
  const masters = useApi<Masters>("/api/masters");
  const findingsApi = useApi<Finding[]>("/api/findings?view=media-selector");

  const user = meApi.data?.user;
  const isAdmin = user?.role === "MASTER_ADMIN" || user?.role === "ADMIN";

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [pillarFilter, setPillarFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState("");
  const [uploadType, setUploadType] = useState<"BEFORE" | "AFTER">("BEFORE");
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ secureUrl: string; publicId: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingAssociation, setIsSavingAssociation] = useState(false);

  // Large File Alert State
  const [compressionAlert, setCompressionAlert] = useState<{
    file: File;
    sizeMb: string;
  } | null>(null);

  // Notification state
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filtered Media list
  const filteredMedia = useMemo(() => {
    if (!mediaApi.data) return [];
    return mediaApi.data.filter((item) => {
      const matchesSearch =
        item.sourceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.zone.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPillar = pillarFilter === "ALL" || item.category === pillarFilter;
      const matchesType = typeFilter === "ALL" || item.type === typeFilter;
      const matchesZone = zoneFilter === "ALL" || item.zone === zoneFilter;
      const matchesDept = deptFilter === "ALL" || item.department === deptFilter;
      const itemDate = item.date ? item.date.slice(0, 10) : "";
      const matchesFrom = !dateRange.from || (itemDate && itemDate >= dateRange.from);
      const matchesTo = !dateRange.to || (itemDate && itemDate <= dateRange.to);

      return matchesSearch && matchesPillar && matchesType && matchesZone && matchesDept && matchesFrom && matchesTo;
    });
  }, [mediaApi.data, searchQuery, pillarFilter, typeFilter, zoneFilter, deptFilter, dateRange]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === filteredMedia.length ? new Set() : new Set(filteredMedia.map((item) => item.id))
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toDownloadUrl = (url: string) => url.replace("/upload/", "/upload/fl_attachment/");

  // Statistics Calculation
  const stats = useMemo(() => {
    const list = mediaApi.data || [];
    return {
      total: list.length,
      before: list.filter(i => i.type === "BEFORE").length,
      after: list.filter(i => i.type === "AFTER").length,
      audit: list.filter(i => i.type === "AUDIT").length,
    };
  }, [mediaApi.data]);

  // Open findings list for selector
  const activeFindings = useMemo(() => {
    if (!findingsApi.data) return [];
    return findingsApi.data.filter(f => f.status !== "CLOSED");
  }, [findingsApi.data]);

  // Media Delete Handler
  const handleDeleteMedia = async (publicId: string) => {
    if (!window.confirm("Are you sure you want to delete this media asset? This will remove it from its associated finding/audit log and cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/media?publicId=${encodeURIComponent(publicId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete asset");
      }

      setSuccessMsg("Media asset deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      mediaApi.reload();
      findingsApi.reload();
    } catch (err: any) {
      setErrorMsg(`Deletion failed: ${err.message}`);
      setTimeout(() => setErrorMsg(""), 5000);
    }
  };

  // Bulk Delete Handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected media asset(s)? This cannot be undone.`)) return;

    const targets = filteredMedia.filter((item) => selectedIds.has(item.id));
    let failed = 0;
    for (const item of targets) {
      try {
        const response = await fetch(`/api/media?publicId=${encodeURIComponent(item.publicId)}`, { method: "DELETE" });
        if (!response.ok) failed += 1;
      } catch {
        failed += 1;
      }
    }

    setSelectedIds(new Set());
    mediaApi.reload();
    findingsApi.reload();
    if (failed > 0) {
      setErrorMsg(`${failed} of ${targets.length} deletions failed.`);
      setTimeout(() => setErrorMsg(""), 5000);
    } else {
      setSuccessMsg(`${targets.length} media asset(s) deleted successfully.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  // Bulk Download Handler — sequential to avoid popup-blocker issues with multiple simultaneous windows
  const handleBulkDownload = async () => {
    const targets = filteredMedia.filter((item) => selectedIds.has(item.id));
    for (const item of targets) {
      const a = document.createElement("a");
      a.href = toDownloadUrl(item.url);
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  // Upload Interceptor
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    if (file.size > 3 * 1024 * 1024) {
      setCompressionAlert({ file, sizeMb });
      event.target.value = "";
      return;
    }

    executeUpload(file);
    event.target.value = "";
  };

  // Cloudinary Direct Upload
  const executeUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const processed = await processImageToWebP(file);
      const formData = new FormData();
      formData.append("file", processed.file);
      formData.append("folderSuffix", uploadType === "BEFORE" ? "audit-photos" : "capa-photos");

      const result = await apiUpload<UploadedPhoto>("/api/upload", formData);
      setUploadedPhotos(prev => [...prev, { secureUrl: result.secureUrl, publicId: result.publicId, sizeBytes: result.sizeBytes, uploadedBy: result.uploadedBy, uploadedByName: result.uploadedByName }]);
      setSuccessMsg("Image uploaded & optimized successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(`Upload failed: ${err.message}`);
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  // Save Link/Association to Database
  const handleSaveAssociation = async () => {
    if (!selectedFindingId) {
      alert("Please select a finding to link this media asset.");
      return;
    }
    if (uploadedPhotos.length === 0) {
      alert("Please upload at least one photo first.");
      return;
    }

    setIsSavingAssociation(true);
    try {
      // 1. Fetch current finding
      const targetFinding = findingsApi.data?.find(f => f._id === selectedFindingId);
      if (!targetFinding) throw new Error("Target finding not found");

      // 2. Append new photos to matching array
      const payload: any = {};
      if (uploadType === "BEFORE") {
        payload.beforePhotos = [...(targetFinding.beforePhotos || []), ...uploadedPhotos];
      } else {
        payload.afterPhotos = [...(targetFinding.afterPhotos || []), ...uploadedPhotos];
      }

      // 3. Send update
      const response = await fetch(`/api/findings/${selectedFindingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update finding");
      }

      setSuccessMsg("Media associated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
      setIsUploadModalOpen(false);
      setSelectedFindingId("");
      setUploadedPhotos([]);
      mediaApi.reload();
      findingsApi.reload();
    } catch (err: any) {
      setErrorMsg(`Association failed: ${err.message}`);
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setIsSavingAssociation(false);
    }
  };

  const removeUploadedPhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, idx) => idx !== index));
  };

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-t1">Media Manager</h2>
          <p className="mt-1 text-sm text-t2">Centralized digital assets, evidence library, and closure confirmations registry.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d"
          onClick={() => setIsUploadModalOpen(true)}
        >
          <UploadCloud size={16} /> Upload & Link Media
        </button>
      </div>

      {/* SUCCESS & ERROR NOTES */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] p-3 text-sm text-[#065f46]">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]">
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {/* STATISTICS CARDS */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="grid gap-1.5 rounded-lg border border-bd border-l-4 border-l-t2 bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Total Media Files</span>
          <span className="text-[32px] font-extrabold text-t1">{mediaApi.loading ? "..." : stats.total}</span>
        </div>
        <div className="grid gap-1.5 rounded-lg border border-bd border-l-4 border-l-red bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audit Findings (Before)</span>
          <span className="text-[32px] font-extrabold text-t1">{mediaApi.loading ? "..." : stats.before}</span>
        </div>
        <div className="grid gap-1.5 rounded-lg border border-bd border-l-4 border-l-green bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">CAPA Resolutions (After)</span>
          <span className="text-[32px] font-extrabold text-t1">{mediaApi.loading ? "..." : stats.after}</span>
        </div>
        <div className="grid gap-1.5 rounded-lg border border-bd border-l-4 border-l-[#3b82f6] bg-bg1 p-4 shadow-[var(--shadow-sm)]">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Checklist References</span>
          <span className="text-[32px] font-extrabold text-t1">{mediaApi.loading ? "..." : stats.audit}</span>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="mb-5 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          {/* Search bar */}
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-t2" />
            <input
              type="text"
              className="w-full rounded-lg border border-bd py-2.5 pr-3 pl-9 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
              placeholder="Search ID, description, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Pillar / Category filter */}
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value)}
          >
            <option value="ALL">All 6S Pillars</option>
            <option value="Sort">Sort (Seiri)</option>
            <option value="Set in Order">Set in Order (Seiton)</option>
            <option value="Shine">Shine (Seiso)</option>
            <option value="Standardize">Standardize (Seiketsu)</option>
            <option value="Sustain">Sustain (Shitsuke)</option>
            <option value="Safety">Safety</option>
            <option value="Environment">Environment</option>
          </select>

          {/* Workflow Phase / Type filter */}
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Phases</option>
            <option value="BEFORE">Before (Audit)</option>
            <option value="AFTER">After (CAPA)</option>
            <option value="AUDIT">Checklist Refs</option>
          </select>

          {/* Zone filter */}
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="ALL">All Zones</option>
            {masters.data?.zones.map(z => (
              <option key={z.name} value={z.name}>{z.name}</option>
            ))}
          </select>

          {/* Department filter */}
          <select
            className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Depts</option>
            {masters.data?.departments.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-bd pt-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-t2">
            From:
            <input
              type="date"
              className="rounded-lg border border-bd px-2.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
              value={fromDateInput}
              onChange={(e) => setFromDateInput(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-t2">
            To:
            <input
              type="date"
              className="rounded-lg border border-bd px-2.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
              value={toDateInput}
              onChange={(e) => setToDateInput(e.target.value)}
            />
          </label>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-d"
            onClick={() => setDateRange({ from: fromDateInput, to: toDateInput })}
          >
            Apply
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-3 py-2 text-xs font-bold text-t1 hover:bg-bg3"
            onClick={() => { setFromDateInput(""); setToDateInput(""); setDateRange({ from: "", to: "" }); }}
          >
            <X size={12} /> Clear
          </button>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-bd bg-bg1 p-3 shadow-[var(--shadow-sm)]">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-white px-3 py-2 text-xs font-bold text-t1 hover:bg-bg3"
            onClick={handleBulkDownload}
          >
            <Download size={13} /> Download Selected
          </button>
          {isAdmin && (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red hover:bg-accent"
              onClick={handleBulkDelete}
            >
              <Trash2 size={13} /> Delete Selected
            </button>
          )}
          <span className="text-xs font-semibold text-t2">{selectedIds.size} selected</span>
        </div>
      )}

      {/* MEDIA GRID */}
      {mediaApi.loading ? (
        <div className="p-10 text-center text-t2">
          Loading optimized media assets...
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-bd bg-bg1 px-5 py-15 text-center shadow-[var(--shadow-sm)]">
          <FolderOpen size={48} className="mb-4 text-t2" />
          <h4 className="mb-1.5 font-extrabold text-t1">No Media Assets Found</h4>
          <p className="m-0 max-w-[400px] text-sm text-t2">
            No photos match your current filters. Try resetting search fields or upload a new photo.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bd bg-bg1 shadow-[var(--shadow-sm)]">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-bg3 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredMedia.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Preview</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Description</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Category</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Type</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Dept</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Related</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Uploaded By</th>
                <th className="bg-bg3 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-t2">Size</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Date</th>
                <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedia.map((item) => (
                <tr key={item.id} className={selectedIds.has(item.id) ? "bg-accent/40" : undefined}>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.sourceNumber}`}
                    />
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <img src={item.url} alt={item.description} className="h-12 w-12 cursor-pointer rounded-md border border-bd object-cover" />
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top max-w-[240px]">
                    <span className="line-clamp-2 text-[13px] font-medium">{item.description}</span>
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-brand-d whitespace-nowrap">{item.category}</span>
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white whitespace-nowrap"
                      style={{ background: item.type === "BEFORE" ? "#dc2626" : item.type === "AFTER" ? "#15803d" : "#3b82f6" }}
                    >
                      {item.type === "BEFORE" ? "Before" : item.type === "AFTER" ? "After" : "Checklist"}
                    </span>
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top whitespace-nowrap text-t2">{item.department}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top whitespace-nowrap font-semibold text-brand-d">{item.sourceNumber}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top whitespace-nowrap text-t2">{item.uploadedByName || "—"}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-right whitespace-nowrap text-t2">{formatFileSize(item.sizeBytes)}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top whitespace-nowrap text-t2">{item.date ? new Date(item.date).toLocaleDateString() : "—"}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <div className="flex flex-wrap items-center gap-2.5 whitespace-nowrap text-xs font-semibold">
                      <button
                        className="text-t2 hover:text-brand-d"
                        onClick={(e) => { (e.currentTarget.closest("tr")?.querySelector("img") as HTMLImageElement | null)?.click(); }}
                      >
                        Preview
                      </button>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-t2 hover:text-brand-d">Open</a>
                      <a href={toDownloadUrl(item.url)} className="text-t2 hover:text-brand-d">Download</a>
                      {isAdmin && (
                        <button className="text-red hover:text-brand-d" onClick={() => handleDeleteMedia(item.publicId)}>Trash</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* UPLOAD & ASSOCIATION MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-[rgba(15,23,42,0.6)] p-5 backdrop-blur-sm">
          <div className="relative w-full max-w-[500px] rounded-lg border border-bd bg-bg1 p-6 shadow-[var(--shadow-sm)]">
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute right-3 top-3 z-30 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-bd bg-white text-t2 shadow-[0_4px_14px_rgba(15,23,42,0.12)] hover:bg-bg3"
              aria-label="Close upload dialog"
            >
              <X size={20} />
            </button>

            <h3 className="mb-1.5 pr-12 text-lg font-extrabold">Upload & Link Portal Media</h3>
            <p className="mb-5 text-[13px] text-t2">
              Upload optimized evidence photos and link them directly to a live non-conformity finding record.
            </p>

            <div className="grid gap-3.5">
              <label>
                <span className="mb-1.5 block text-xs font-bold">1. Target Finding *</span>
                <select
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={selectedFindingId}
                  onChange={(e) => setSelectedFindingId(e.target.value)}
                >
                  <option value="">Select Target Finding...</option>
                  {activeFindings.map(f => (
                    <option key={f._id} value={f._id}>{f.findingNumber} - {f.question.slice(0, 40)}...</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold">2. Phase Location</span>
                <select
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as any)}
                >
                  <option value="BEFORE">Before Photo (Evidence / Audit Stage)</option>
                  <option value="AFTER">After Photo (Resolution / CAPA Stage)</option>
                </select>
              </label>

              <div>
                <span className="mb-2 block text-xs font-bold">3. Select Photo (WebP Auto-Conversion)</span>

                <div className="flex flex-wrap items-center gap-2">
                  {uploadedPhotos.map((p, idx) => (
                    <div key={idx} className="relative h-[65px] w-[65px]">
                      <img src={p.secureUrl} alt="Upload" className="h-full w-full rounded-md border border-bd object-cover" />
                      <button
                        onClick={() => removeUploadedPhoto(idx)}
                        className="absolute -top-1 -right-1 grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full border-none bg-red text-[10px] text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  <label
                    className="flex h-[65px] w-[65px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-t2 bg-transparent p-0"
                  >
                    <UploadCloud size={16} className="text-t2" />
                    <span className="mt-0.5 text-[10px] text-t2">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {isUploading && (
                  <span className="mt-1.5 block text-xs text-brand-d">
                    Uploading & converting to WebP...
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-bd pt-3.5">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-[.55]"
                onClick={handleSaveAssociation}
                disabled={isSavingAssociation || uploadedPhotos.length === 0}
              >
                {isSavingAssociation ? "Saving..." : "Link Photos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPRESSION WARNING DIALOG */}
      {compressionAlert && (
        <div className="fixed inset-0 z-[100000] grid place-items-center bg-[rgba(15,23,42,0.6)] p-5 backdrop-blur-sm">
          <div className="flex w-full max-w-[420px] flex-col items-center gap-3.5 rounded-lg border border-bd bg-bg1 p-6 text-center shadow-[var(--shadow-sm)]">
            <div className="inline-flex rounded-full bg-[#fef9c3] p-3 text-[#eab308]">
              <AlertTriangle size={36} />
            </div>

            <div>
              <h3 className="mb-1.5 text-lg font-extrabold">Large File Warning</h3>
              <p className="m-0 text-sm leading-normal text-t2">
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-[13px] font-bold text-t1 hover:bg-bg3"
                onClick={() => setCompressionAlert(null)}
              >
                Cancel
              </button>
              <button
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-[13px] font-bold text-white hover:bg-brand-d"
                onClick={() => {
                  const fileToUpload = compressionAlert.file;
                  setCompressionAlert(null);
                  executeUpload(fileToUpload);
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
