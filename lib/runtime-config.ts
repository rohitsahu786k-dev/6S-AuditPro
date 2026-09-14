export function positiveInteger(name: string, fallback: number, maximum = 60_000) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid ${name}`);
  return value;
}

/**
 * Working days a finding gets to be closed when no target date is supplied.
 * Audits and the reconciler already counted working days; the ad-hoc finding route
 * counted calendar days, so the same rule produced two different dates.
 */
export function findingDueWorkingDays() {
  return positiveInteger("FINDING_DUE_WORKING_DAYS", 7, 365);
}

/** Largest accepted evidence photo. Must stay within the request body cap. */
export function maxUploadBytes() {
  return positiveInteger("MAX_UPLOAD_MB", 5, 6) * 1024 * 1024;
}

/** How long a signed-in session stays valid, in days. */
export function sessionMaxAgeSeconds() {
  return positiveInteger("SESSION_MAX_AGE_DAYS", 7, 90) * 24 * 60 * 60;
}

export function adhocEmailRecipients() {
  const values = (process.env.ADHOC_AUDIT_EMAIL_RECIPIENTS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (values.some((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error("Invalid ADHOC_AUDIT_EMAIL_RECIPIENTS");
  return [...new Set(values)];
}
