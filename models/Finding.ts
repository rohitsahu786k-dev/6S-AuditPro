import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PhotoSchema = new Schema({ secureUrl: String, publicId: String }, { _id: false });
const TimelineSchema = new Schema({
  action: String,
  note: String,
  by: { type: Schema.Types.ObjectId, ref: "User" },
  byName: String,
  at: { type: Date, default: Date.now }
}, { _id: false });

const FindingSchema = new Schema({
  findingNumber: { type: String, required: true, unique: true, index: true },
  auditId: { type: Schema.Types.ObjectId, ref: "Audit", index: true },
  auditNumber: { type: String, index: true },
  zone: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  questionId: String,
  category: { type: String, required: true, index: true },
  question: { type: String, required: true },
  severity: { type: String, enum: ["Critical", "High", "Medium", "Low"], default: "Medium", index: true },
  observation: String,
  beforePhotos: [PhotoSchema],
  assignedTo: String,
  assignedUser: { type: Schema.Types.ObjectId, ref: "User" },
  dueDate: { type: Date, index: true },
  capaAction: String,
  capaStatus: { type: String, enum: ["NOT_SUBMITTED", "SUBMITTED", "APPROVED", "REJECTED"], default: "NOT_SUBMITTED" },
  afterPhotos: [PhotoSchema],
  closureRemarks: String,
  auditorReviewStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  rejectionReason: String,
  timeline: [TimelineSchema],
  status: { type: String, enum: ["OPEN", "IN_PROGRESS", "SUBMITTED", "CLOSED", "REJECTED", "REOPENED", "OVERDUE"], default: "OPEN", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

FindingSchema.index({ department: 1, status: 1 });
FindingSchema.index({ dueDate: 1, status: 1 });

export type FindingDocument = InferSchemaType<typeof FindingSchema> & { _id: mongoose.Types.ObjectId };
const Finding = (mongoose.models.Finding as Model<FindingDocument>) || mongoose.model<FindingDocument>("Finding", FindingSchema);
export default Finding;
