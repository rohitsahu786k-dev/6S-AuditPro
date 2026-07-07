"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

export function GlobalMediaLightbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. Check if clicked element is an image (excluding logos/UI buttons)
      if (target.tagName === "IMG") {
        const img = target as HTMLImageElement;
        
        // Skip small UI icons, avatars, and sidebar logos
        if (
          img.closest(".brand") ||
          img.closest(".logo") ||
          img.closest(".profile-avatar") ||
          img.width < 50 ||
          img.height < 50
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        openLightbox(img.src, "image");
        return;
      }

      // 2. Check if clicked element is a video
      if (target.tagName === "VIDEO") {
        const video = target as HTMLVideoElement;
        e.preventDefault();
        e.stopPropagation();
        openLightbox(video.src || video.querySelector("source")?.src || "", "video");
        return;
      }

      // 3. Check if clicked element is an anchor pointing to an image/video
      const anchor = target.closest("a");
      if (anchor) {
        const href = anchor.href.toLowerCase();
        const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(href) || href.includes("cloudinary.com") && !href.includes(".pdf");
        const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(href);

        if (isImage || isVideo) {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(anchor.href, isImage ? "image" : "video");
        }
      }
    };

    document.addEventListener("click", handleGlobalClick, true);
    return () => {
      document.removeEventListener("click", handleGlobalClick, true);
    };
  }, []);

  const openLightbox = (url: string, type: "image" | "video") => {
    if (!url) return;
    setMediaUrl(url);
    setMediaType(type);
    setZoom(1);
    setRotation(0);
    setIsOpen(true);
  };

  const closeLightbox = () => {
    setIsOpen(false);
    setMediaUrl("");
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = mediaUrl.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(mediaUrl, "_blank");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="lightbox-overlay"
      onClick={closeLightbox}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(10, 15, 30, 0.9)",
        backdropFilter: "blur(12px)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      {/* Top Toolbar */}
      <div 
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          display: "flex",
          gap: "12px",
          zIndex: 100000,
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          padding: "8px 16px",
          borderRadius: "30px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}
        onClick={e => e.stopPropagation()}
      >
        {mediaType === "image" && (
          <>
            <button className="lightbox-btn" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <button className="lightbox-btn" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <button className="lightbox-btn" onClick={handleRotate} title="Rotate">
              <RotateCw size={18} />
            </button>
          </>
        )}
        <button className="lightbox-btn" onClick={handleDownload} title="Download">
          <Download size={18} />
        </button>
        <div style={{ width: "1px", background: "rgba(255, 255, 255, 0.2)", margin: "0 4px" }} />
        <button className="lightbox-btn close" onClick={closeLightbox} title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Main Content Area */}
      <div 
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        {mediaType === "image" ? (
          <img 
            src={mediaUrl} 
            alt="Lightbox Media" 
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              objectFit: "contain",
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.25s cubic-bezier(0.1, 0.76, 0.55, 0.94)",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
              borderRadius: "8px",
              pointerEvents: "auto"
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <video 
            src={mediaUrl} 
            controls 
            autoPlay
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
              borderRadius: "8px",
              pointerEvents: "auto"
            }}
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .lightbox-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }
        .lightbox-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }
        .lightbox-btn.close:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}
