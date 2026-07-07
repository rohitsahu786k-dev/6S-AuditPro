/**
 * Media processing utility for 6S AuditPro.
 * Handles client-side WebP image conversion, sizing validation, and compression helpers.
 */

export interface ProcessedMedia {
  file: File;
  originalName: string;
  originalSize: number;
  newSize: number;
  wasCompressed: boolean;
  needsManualCompress: boolean;
}

/**
 * Validates and converts an image to WebP client-side using Canvas.
 * If the image is > 3MB, alerts the system that manual compression (e.g. via imagecompressor.com) is recommended,
 * but still performs canvas-based compression as a best-effort fallback.
 */
export async function processImageToWebP(file: File, maxSizeBytes = 3 * 1024 * 1024): Promise<ProcessedMedia> {
  const needsManualCompress = file.size > maxSizeBytes;
  
  // Non-image files (videos, PDFs, etc.) are passed through as-is
  if (!file.type.startsWith("image/")) {
    return {
      file,
      originalName: file.name,
      originalSize: file.size,
      newSize: file.size,
      wasCompressed: false,
      needsManualCompress: false,
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Downscale very large images to save memory and processing time
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve({
            file,
            originalName: file.name,
            originalSize: file.size,
            newSize: file.size,
            wasCompressed: false,
            needsManualCompress,
          });
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Adjust quality based on original file size to ensure compact files
        let quality = 0.82;
        if (file.size > 2 * 1024 * 1024) quality = 0.65; // High compression for big files
        if (file.size > 5 * 1024 * 1024) quality = 0.50; // Extreme compression fallback

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({
                file,
                originalName: file.name,
                originalSize: file.size,
                newSize: file.size,
                wasCompressed: false,
                needsManualCompress,
              });
            }

            // Create new File object with webp type and extension
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const webpFile = new File([blob], `${baseName}.webp`, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve({
              file: webpFile,
              originalName: file.name,
              originalSize: file.size,
              newSize: webpFile.size,
              wasCompressed: webpFile.size < file.size,
              needsManualCompress,
            });
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => {
        resolve({
          file,
          originalName: file.name,
          originalSize: file.size,
          newSize: file.size,
          wasCompressed: false,
          needsManualCompress,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      resolve({
        file,
        originalName: file.name,
        originalSize: file.size,
        newSize: file.size,
        wasCompressed: false,
        needsManualCompress,
      });
    };
    reader.readAsDataURL(file);
  });
}
