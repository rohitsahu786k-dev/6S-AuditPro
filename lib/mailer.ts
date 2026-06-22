import nodemailer from "nodemailer";

export function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!host || !user || !pass) throw new Error("SMTP is not fully configured");

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass }
  });
}

export function fromAddress() {
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const name = process.env.SMTP_FROM_NAME || "6S AuditPro";
  return email ? `"${name}" <${email}>` : undefined;
}
