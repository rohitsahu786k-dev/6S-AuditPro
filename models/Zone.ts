import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ZoneSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  department: { type: String, required: true, trim: true, index: true },
  location: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export type ZoneDocument = InferSchemaType<typeof ZoneSchema> & { _id: mongoose.Types.ObjectId };
const Zone = (mongoose.models.Zone as Model<ZoneDocument>) || mongoose.model<ZoneDocument>("Zone", ZoneSchema);
export default Zone;
