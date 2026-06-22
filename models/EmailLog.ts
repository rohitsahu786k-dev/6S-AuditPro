import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const EmailLogSchema = new Schema({
  templateKey: { type: String, index: true },
  triggerEvent: { type: String, index: true },
  recipients: [{ type: String }],
  cc: [{ type: String }],
  bcc: [{ type: String }],
  subject: String,
  status: { type: String, enum: ["sent", "failed", "skipped"], required: true, index: true },
  errorMessage: String,
  relatedAuditId: { type: Schema.Types.ObjectId, ref: "Audit" },
  relatedFindingId: { type: Schema.Types.ObjectId, ref: "Finding" },
  sentBySystem: { type: Boolean, default: true },
  payload: { type: Schema.Types.Mixed }
}, { timestamps: true });

export type EmailLogDocument = InferSchemaType<typeof EmailLogSchema> & { _id: mongoose.Types.ObjectId };
const EmailLog = (mongoose.models.EmailLog as Model<EmailLogDocument>) || mongoose.model<EmailLogDocument>("EmailLog", EmailLogSchema);
export default EmailLog;
