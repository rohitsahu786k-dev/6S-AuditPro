import { CATEGORIES } from "@/lib/constants";

export type ChecklistResponse = {
  category: string;
  response: "Adequate" | "Not Adequate" | "N/A";
};

export function scoreChecklist(items: ChecklistResponse[]) {
  const categoryScores: Record<string, { adequate: number; total: number; score: number }> = {};
  for (const category of CATEGORIES) categoryScores[category] = { adequate: 0, total: 0, score: 0 };

  for (const item of items) {
    if (item.response === "N/A") continue;
    const bucket = categoryScores[item.category] || { adequate: 0, total: 0, score: 0 };
    bucket.total += 1;
    if (item.response === "Adequate") bucket.adequate += 1;
    bucket.score = bucket.total ? Math.round((bucket.adequate / bucket.total) * 100) : 0;
    categoryScores[item.category] = bucket;
  }

  const counted = Object.values(categoryScores).filter((s) => s.total > 0);
  const totalScore = counted.length ? Math.round(counted.reduce((sum, s) => sum + s.score, 0) / counted.length) : 0;
  return { categoryScores, totalScore };
}

export function scoreLabel(score: number) {
  if (score <= 30) return { label: "1S", desc: "Sort Only" };
  if (score <= 50) return { label: "2S", desc: "Set in Order" };
  if (score <= 70) return { label: "3S", desc: "Shine" };
  if (score <= 80) return { label: "4S", desc: "Standardize" };
  if (score <= 90) return { label: "5S", desc: "Sustain" };
  return { label: "6S", desc: "Safety + Sustain" };
}

export function addWorkingDays(start: Date, days: number) {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

export function defaultSeverity(response: string, category: string) {
  if (response !== "Not Adequate") return undefined;
  if (category === "SAFETY") return "Critical";
  if (category === "ENVIRONMENT") return "High";
  return "Medium";
}
