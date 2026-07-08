import { ALLOWED_IMAGE_TYPES, configureCloudinary, MAX_UPLOAD_BYTES } from "@/lib/cloudinary";

const SAFE_FOLDER_SUFFIX = /^[a-zA-Z0-9_-]{1,64}$/;

export async function uploadImage(file: File, folderSuffix = "audit-photos") {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw Object.assign(new Error("Unsupported image type"), { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) throw Object.assign(new Error("File is larger than 5 MB"), { status: 400 });
  if (!SAFE_FOLDER_SUFFIX.test(folderSuffix)) throw Object.assign(new Error("Invalid folderSuffix"), { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let cloudinary: ReturnType<typeof configureCloudinary>;
  try {
    cloudinary = configureCloudinary();
  } catch (error) {
    console.error("Cloudinary configuration error:", error);
    throw Object.assign(new Error("Image upload is not configured. Please verify Cloudinary settings."), { status: 400 });
  }
  const folder = `${process.env.CLOUDINARY_UPLOAD_FOLDER || "onepws-6s-auditpro"}/${folderSuffix}`;

  return new Promise<{ secureUrl: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
      if (error || !result) {
        console.error("Cloudinary upload error:", error || "No upload result returned");
        reject(Object.assign(new Error("Image upload failed. Please check the file and Cloudinary configuration."), { status: 400 }));
      }
      else resolve({ secureUrl: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string) {
  try {
    const cloudinary = configureCloudinary();
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Cloudinary destruction error:", error);
    return false;
  }
}
