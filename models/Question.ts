import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const QuestionSchema = new Schema({
  category: { type: String, required: true, index: true },
  text: { type: String, required: true },
  subSection: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export type QuestionDocument = InferSchemaType<typeof QuestionSchema> & { _id: mongoose.Types.ObjectId };
const Question = (mongoose.models.Question as Model<QuestionDocument>) || mongoose.model<QuestionDocument>("Question", QuestionSchema);
export default Question;
