import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PersonSchema = new Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["AUDITOR", "RESPONSIBLE"], required: true, index: true },
  roleTitle: { type: String, trim: true },
  department: { type: String, trim: true, index: true },
  zone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export type PersonDocument = InferSchemaType<typeof PersonSchema> & { _id: mongoose.Types.ObjectId };
const Person = (mongoose.models.Person as Model<PersonDocument>) || mongoose.model<PersonDocument>("Person", PersonSchema);
export default Person;
