"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  Search,
  Trash2,
  UploadCloud,
  X,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  FolderOpen
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
};

type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "MASTER_ADMIN" | "ADMIN" | "AUDITOR" | "STORES_SPOC" | "PRODUCTION_SPOC" | "MANAGEMENT";
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

export function MediaWorkspace() {
  const mediaApi = useApi<MediaItem[]>("/api/media");
  const meApi = useApi<{ user: SessionUser | null }>("/api/auth/me");
  const masters = useApi<Masters>("/api/masters");
  const findingsApi = useApi<Finding[]>("/api/findings");

  const user = meApi.data?.user;
  const isAdmin = user?.role === "MASTER_ADMIN" || user?.role === "ADMIN";

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [pillarFilter, setPillarFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

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

      return matchesSearch && matchesPillar && matchesType && matchesZone && matchesDept;
    });
  }, [mediaApi.data, searchQuery, pillarFilter, typeFilter, zoneFilter, deptFilter]);

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

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await response.json();
      setUploadedPhotos(prev => [...prev, { secureUrl: result.secureUrl, publicId: result.publicId }]);
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
      <div className="page-head">
        <div>
          <h2 className="page-title">Media Manager</h2>
          <p className="page-sub">Centralized digital assets, evidence library, and closure confirmations registry.</p>
        </div>
        <button className="btn primary" onClick={() => setIsUploadModalOpen(true)}>
          <UploadCloud size={16} /> Upload & Link Media
        </button>
      </div>

      {/* SUCCESS & ERROR NOTES */}
      {successMsg && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {/* STATISTICS CARDS */}
      <div className="grid grid-4" style={{ marginBottom: "20px" }}>
        <div className="card kpi" style={{ borderLeft: "4px solid var(--muted)" }}>
          <span className="label">Total Media Files</span>
          <span className="kpi-value">{mediaApi.loading ? "..." : stats.total}</span>
        </div>
        <div className="card kpi" style={{ borderLeft: "4px solid var(--danger)" }}>
          <span className="label">Audit Findings (Before)</span>
          <span className="kpi-value">{mediaApi.loading ? "..." : stats.before}</span>
        </div>
        <div className="card kpi" style={{ borderLeft: "4px solid var(--ok)" }}>
          <span className="label">CAPA Resolutions (After)</span>
          <span className="kpi-value">{mediaApi.loading ? "..." : stats.after}</span>
        </div>
        <div className="card kpi" style={{ borderLeft: "4px solid #3b82f6" }}>
          <span className="label">Checklist References</span>
          <span className="kpi-value">{mediaApi.loading ? "..." : stats.audit}</span>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="card" style={{ marginBottom: "20px", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "12px", alignItems: "center" }}>
          {/* Search bar */}
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input 
              type="text" 
              className="control" 
              style={{ paddingLeft: "36px" }}
              placeholder="Search ID, description, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Pillar / Category filter */}
          <select className="control" value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value)}>
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
          <select className="control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All Phases</option>
            <option value="BEFORE">Before (Audit)</option>
            <option value="AFTER">After (CAPA)</option>
            <option value="AUDIT">Checklist Refs</option>
          </select>

          {/* Zone filter */}
          <select className="control" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="ALL">All Zones</option>
            {masters.data?.zones.map(z => (
              <option key={z.name} value={z.name}>{z.name}</option>
            ))}
          </select>

          {/* Department filter */}
          <select className="control" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="ALL">All Depts</option>
            {masters.data?.departments.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* MEDIA GRID */}
      {mediaApi.loading ? (
        <div style={{ textAlign: "center", padding: "40px" }} className="muted">
          Loading optimized media assets...
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" }}>
          <FolderOpen size={48} className="muted" style={{ marginBottom: "16px" }} />
          <h4 style={{ margin: "0 0 6px", fontWeight: 800 }}>No Media Assets Found</h4>
          <p className="muted" style={{ fontSize: "14px", maxWidth: "400px", margin: 0 }}>
            No photos match your current filters. Try resetting search fields or upload a new photo.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {filteredMedia.map((item) => (
            <div 
              key={item.id}
              className="card media-card"
              style={{
                padding: 0,
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                border: "1px solid var(--line)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            >
              {/* Media Thumbnail Container */}
              <div style={{ position: "relative", paddingBottom: "70%", overflow: "hidden", background: "#0f172a" }}>
                <img 
                  src={item.url} 
                  alt={item.description}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    cursor: "pointer",
                    transition: "transform 0.5s ease"
                  }}
                  className="gallery-image"
                />

                {/* Phase Tag Badge */}
                <span 
                  className="badge" 
                  style={{ 
                    position: "absolute", 
                    top: "12px", 
                    left: "12px", 
                    zIndex: 10,
                    background: item.type === "BEFORE" ? "rgba(220, 38, 38, 0.9)" : item.type === "AFTER" ? "rgba(21, 128, 61, 0.9)" : "rgba(59, 130, 246, 0.9)",
                    color: "#fff",
                    borderColor: "transparent",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                  }}
                >
                  {item.type === "BEFORE" ? "Before (Audit)" : item.type === "AFTER" ? "After (CAPA)" : "Checklist Ref"}
                </span>

                {/* Severity Badge */}
                <span 
                  className="badge" 
                  style={{ 
                    position: "absolute", 
                    top: "12px", 
                    right: "12px", 
                    zIndex: 10,
                    background: item.severity === "Critical" ? "#fef2f2" : item.severity === "High" ? "#fff7ed" : item.severity === "Medium" ? "#fefce8" : "#f0fdf4",
                    color: item.severity === "Critical" ? "#991b1b" : item.severity === "High" ? "#c2410c" : item.severity === "Medium" ? "#a16207" : "#166534",
                    borderColor: item.severity === "Critical" ? "#fee2e2" : item.severity === "High" ? "#ffedd5" : item.severity === "Medium" ? "#fef9c3" : "#dcfce7",
                    fontSize: "10px"
                  }}
                >
                  {item.severity}
                </span>
              </div>

              {/* Card Meta Content */}
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: "var(--brand-dark)", fontSize: "14px" }}>
                    {item.sourceNumber}
                  </span>
                  <span className="muted" style={{ fontSize: "11px" }}>
                    {item.date ? new Date(item.date).toLocaleDateString() : ""}
                  </span>
                </div>

                <p style={{ margin: "4px 0", fontSize: "13px", fontWeight: 500, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: "36px" }}>
                  {item.description}
                </p>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "8px", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                    {item.zone}
                  </span>
                  <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                    {item.department}
                  </span>
                  <span style={{ background: "var(--brand-soft)", color: "var(--brand-dark)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                    {item.category}
                  </span>
                </div>
              </div>

              {/* Admin Deletion Action */}
              {isAdmin && (
                <button 
                  onClick={() => handleDeleteMedia(item.publicId)}
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px",
                    background: "rgba(254, 242, 242, 0.8)",
                    border: "1px solid #fee2e2",
                    borderRadius: "6px",
                    color: "var(--danger)",
                    padding: "6px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    zIndex: 20
                  }}
                  title="Delete Media File"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* UPLOAD & ASSOCIATION MODAL */}
      {isUploadModalOpen && (
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
              maxWidth: "500px", 
              position: "relative", 
              padding: "24px" 
            }}
          >
            <button 
              onClick={() => setIsUploadModalOpen(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 800 }}>Upload & Link Portal Media</h3>
            <p className="muted" style={{ fontSize: "13px", margin: "0 0 20px" }}>
              Upload optimized evidence photos and link them directly to a live non-conformity finding record.
            </p>

            <div style={{ display: "grid", gap: "14px" }}>
              <label>
                <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>1. Target Finding *</span>
                <select 
                  className="control" 
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
                <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>2. Phase Location</span>
                <select 
                  className="control" 
                  value={uploadType} 
                  onChange={(e) => setUploadType(e.target.value as any)}
                >
                  <option value="BEFORE">Before Photo (Evidence / Audit Stage)</option>
                  <option value="AFTER">After Photo (Resolution / CAPA Stage)</option>
                </select>
              </label>

              <div>
                <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "8px" }}>3. Select Photo (WebP Auto-Conversion)</span>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  {uploadedPhotos.map((p, idx) => (
                    <div key={idx} style={{ position: "relative", width: "65px", height: "65px" }}>
                      <img src={p.secureUrl} alt="Upload" style={{ width: "100%", height: "100%", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--line)" }} />
                      <button 
                        onClick={() => removeUploadedPhoto(idx)}
                        style={{ position: "absolute", top: "-4px", right: "-4px", background: "var(--danger)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  <label 
                    className="btn" 
                    style={{ 
                      width: "65px", 
                      height: "65px", 
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
                    <span style={{ fontSize: "10px", marginTop: "2px" }} className="muted">Add</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      style={{ display: "none" }} 
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {isUploading && (
                  <span style={{ fontSize: "12px", color: "var(--brand-dark)", marginTop: "6px", display: "block" }}>
                    Uploading & converting to WebP...
                  </span>
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", marginTop: "24px", paddingTop: "14px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn" onClick={() => setIsUploadModalOpen(false)}>Cancel</button>
              <button 
                className="btn primary" 
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

      {/* Gallery Hover Effect CSS */}
      <style jsx global>{`
        .media-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(26, 35, 50, 0.12) !important;
          border-color: #cbd5e1 !important;
        }
        .media-card:hover .gallery-image {
          transform: scale(1.06);
        }
      `}</style>
    </>
  );
}
