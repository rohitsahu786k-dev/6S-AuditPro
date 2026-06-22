import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const DepartmentSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export type DepartmentDocument = InferSchemaType<typeof DepartmentSchema> & { _id: mongoose.Types.ObjectId };
const Department = (mongoose.models.Department as Model<DepartmentDocument>) || mongoose.model<DepartmentDocument>("Department", DepartmentSchema);
export default Department;
