import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";

export async function getAnalyticsSnapshot() {
  await connectDB();
  const [audits, findings] = await Promise.all([Audit.find().lean(), Finding.find().lean()]);
  const closureRate = findings.length ? Math.round((findings.filter((f) => f.status === "CLOSED").length / findings.length) * 100) : 0;
  const avgScore = audits.length ? Math.round(audits.reduce((sum, audit) => sum + (audit.totalScore || 0), 0) / audits.length) : 0;
  return { audits: audits.length, findings: findings.length, closureRate, avgScore };
}
