import { ALLOWED_IMAGE_TYPES, configureCloudinary, MAX_UPLOAD_BYTES } from "@/lib/cloudinary";

export async function uploadImage(file: File, folderSuffix = "audit-photos") {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw Object.assign(new Error("Unsupported image type"), { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) throw Object.assign(new Error("File is larger than 5 MB"), { status: 400 });

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
