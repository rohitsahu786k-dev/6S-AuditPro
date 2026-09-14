import crypto from "node:crypto";
import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";
import { connectDB } from "@/lib/db";

const schema = new Schema({
  _id: String,
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { versionKey: false });
const RateLimit = (mongoose.models.RateLimit as Model<InferSchemaType<typeof schema>>) || mongoose.model("RateLimit", schema);

// Fixed-window counters are shared across server instances. Keys never store raw identifiers.
export async function consumeRateLimit(action: string, identifier: string, limit: number, windowMs: number) {
  await connectDB();
  const window = Math.floor(Date.now() / windowMs);
  const digest = crypto.createHash("sha256").update(identifier).digest("hex");
  const id = `${action}:${window}:${digest}`;
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) }
  };
  let counter;
  try {
    counter = await RateLimit.findOneAndUpdate({ _id: id }, update, { upsert: true, new: true }).lean();
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    counter = await RateLimit.findOneAndUpdate({ _id: id }, update, { new: true }).lean();
  }
  if (!counter || Number(counter.count) > limit) {
    throw Object.assign(new Error("Too many attempts. Please try again later."), { status: 429 });
  }
}
