import mongoose from "mongoose";
import { positiveInteger } from "@/lib/runtime-config";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };

const cache = globalForMongoose.mongooseCache || { conn: null, promise: null };
globalForMongoose.mongooseCache = cache;

export async function connectDB() {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");

  if (!cache.promise) {
    mongoose.set("maxTimeMS", positiveInteger("MONGODB_QUERY_TIMEOUT_MS", 15_000));
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: positiveInteger("MONGODB_MAX_POOL_SIZE", 5, 100),
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      waitQueueTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
      serverSelectionTimeoutMS: 10_000
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // A rejected promise must not stay cached, otherwise every later request awaits
    // the same failure and the app stays down until the process restarts.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
