import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  role: { type: String, index: true },
  department: { type: String, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: "info" },
  readAt: { type: Date },
  relatedAuditId: { type: Schema.Types.ObjectId, ref: "Audit" },
  relatedFindingId: { type: Schema.Types.ObjectId, ref: "Finding" }
}, { timestamps: true });

export type NotificationDocument = InferSchemaType<typeof NotificationSchema> & { _id: mongoose.Types.ObjectId };
const Notification = (mongoose.models.Notification as Model<NotificationDocument>) || mongoose.model<NotificationDocument>("Notification", NotificationSchema);
export default Notification;
