import { ALLOWED_IMAGE_TYPES, configureCloudinary, MAX_UPLOAD_BYTES } from "@/lib/cloudinary";
import fs from "fs";
import path from "path";

const SAFE_FOLDER_SUFFIX = /^[a-zA-Z0-9_-]{1,64}$/;

export async function uploadImage(file: File, folderSuffix = "audit-photos") {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw Object.assign(new Error("Unsupported image type"), { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) throw Object.assign(new Error("File is larger than 5 MB"), { status: 400 });
  if (!SAFE_FOLDER_SUFFIX.test(folderSuffix)) throw Object.assign(new Error("Invalid folderSuffix"), { status: 400 });

  const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

  if (!isCloudinaryConfigured) {
    // Local File Storage Fallback
    const uploadDir = path.join(process.cwd(), "public", "uploads", folderSuffix);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = file.type.split("/")[1] || "webp";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = path.join(uploadDir, uniqueName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const secureUrl = `/uploads/${folderSuffix}/${uniqueName}`;
    const publicId = `local/${folderSuffix}/${uniqueName}`;

    return { secureUrl, publicId };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const cloudinary = configureCloudinary();
  const folder = `${process.env.CLOUDINARY_UPLOAD_FOLDER || "onepws-6s-auditpro"}/${folderSuffix}`;

  return new Promise<{ secureUrl: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
      if (error || !result) reject(error || new Error("Upload failed"));
      else resolve({ secureUrl: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string) {
  try {
    if (publicId.startsWith("local/")) {
      const parts = publicId.split("/");
      const folderSuffix = parts[1];
      const fileName = parts[2];
      if (!folderSuffix || !fileName || !SAFE_FOLDER_SUFFIX.test(folderSuffix) || !SAFE_FOLDER_SUFFIX.test(fileName)) {
        return false;
      }
      const uploadsRoot = path.join(process.cwd(), "public", "uploads");
      const filePath = path.join(uploadsRoot, folderSuffix, fileName);
      if (!filePath.startsWith(uploadsRoot + path.sep)) {
        return false;
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    }

    const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (!isCloudinaryConfigured) return true;

    const cloudinary = configureCloudinary();
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Cloudinary destruction error:", error);
    return false;
  }
}
