import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ["MASTER_ADMIN", "ADMIN", "AUDITOR", "STORES_SPOC", "PRODUCTION_SPOC", "MANAGEMENT"], index: true },
  department: { type: String, trim: true },
  zone: { type: String, trim: true },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  permissions: [{ type: String }],
  forcePasswordChange: { type: Boolean, default: false },
  passwordChangedAt: { type: Date },
  lastLoginAt: { type: Date },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false }
}, { timestamps: true });

export type UserDocument = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

const User = (mongoose.models.User as Model<UserDocument>) || mongoose.model<UserDocument>("User", UserSchema);
export default User;
