import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ChecklistItemSchema = new Schema({
  questionId: String,
  category: String,
  question: String,
  response: { type: String, enum: ["Adequate", "Not Adequate", "N/A"] },
  observation: String,
  severity: { type: String, enum: ["Critical", "High", "Medium", "Low"] },
  beforePhotos: [{ secureUrl: String, publicId: String }]
}, { _id: false });

const AuditSchema = new Schema({
  auditNumber: { type: String, required: true, unique: true, index: true },
  zone: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  auditor: { type: Schema.Types.ObjectId, ref: "User" },
  auditorName: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ["DRAFT", "COMPLETED", "CANCELLED"], default: "COMPLETED", index: true },
  checklist: [ChecklistItemSchema],
  categoryScores: { type: Schema.Types.Mixed, default: {} },
  totalScore: { type: Number, default: 0 },
  findingIds: [{ type: Schema.Types.ObjectId, ref: "Finding" }],
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

AuditSchema.index({ department: 1, date: -1 });

export type AuditDocument = InferSchemaType<typeof AuditSchema> & { _id: mongoose.Types.ObjectId };
const Audit = (mongoose.models.Audit as Model<AuditDocument>) || mongoose.model<AuditDocument>("Audit", AuditSchema);
export default Audit;
