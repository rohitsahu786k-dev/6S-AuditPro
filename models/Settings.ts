import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export type SettingsDocument = InferSchemaType<typeof SettingsSchema> & { _id: mongoose.Types.ObjectId };
const Settings = (mongoose.models.Settings as Model<SettingsDocument>) || mongoose.model<SettingsDocument>("Settings", SettingsSchema);
export default Settings;
