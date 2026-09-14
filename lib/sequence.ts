import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";
import { connectDB } from "@/lib/db";

const schema = new Schema({ _id: String, value: { type: Number, required: true } }, { versionKey: false });
const Counter = (mongoose.models.Counter as Model<InferSchemaType<typeof schema>>) || mongoose.model("Counter", schema);

export async function nextSequence(collection: string, field: string, prefix: string, width: number) {
  await connectDB();
  const key = `${collection}:${prefix}`;
  if (!(await Counter.exists({ _id: key }))) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const [existing] = await mongoose.connection.collection(collection).aggregate([
      { $match: { [field]: { $regex: `^${escaped}[0-9]+$` } } },
      { $project: { value: { $convert: { input: { $substrBytes: [`$${field}`, prefix.length, 32] }, to: "int", onError: 0, onNull: 0 } } } },
      { $group: { _id: null, value: { $max: "$value" } } }
    ], { maxTimeMS: 15_000 }).toArray();
    try {
      await Counter.updateOne({ _id: key }, { $setOnInsert: { value: existing?.value || 0 } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { value: 1 } }, { new: true }).lean();
  if (!counter) throw new Error("Unable to allocate record number");
  return `${prefix}${String(counter.value).padStart(width, "0")}`;
}
