import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { positiveInteger } from "@/lib/runtime-config";

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
  payload: { type: Schema.Types.Mixed },
  // Written rather than derived from createdAt so the retention window can be
  // changed without rebuilding the index.
  expiresAt: { type: Date, index: { expires: 0 } }
}, { timestamps: true });

/**
 * Opt-in retention. Every notification writes a row here and nothing ever removed
 * one, so the collection grows for the life of the deployment — but these rows are
 * the record that a notification was actually sent, which an audit trail should not
 * discard on its own. Expiry therefore stays off unless an operator sets
 * EMAIL_LOG_RETENTION_DAYS, and rows written before it was set are never touched.
 */
export const EMAIL_LOG_RETENTION_DAYS = process.env.EMAIL_LOG_RETENTION_DAYS
  ? positiveInteger("EMAIL_LOG_RETENTION_DAYS", 180, 3650)
  : 0;

EmailLogSchema.pre("validate", function setExpiry(next) {
  if (EMAIL_LOG_RETENTION_DAYS > 0 && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + EMAIL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  }
  next();
});

export type EmailLogDocument = InferSchemaType<typeof EmailLogSchema> & { _id: mongoose.Types.ObjectId };
const EmailLog = (mongoose.models.EmailLog as Model<EmailLogDocument>) || mongoose.model<EmailLogDocument>("EmailLog", EmailLogSchema);
export default EmailLog;
