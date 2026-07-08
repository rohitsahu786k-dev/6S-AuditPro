const BRAND_RED = "#ef2b2d";
const BRAND_RED_DARK = "#b91c1c";
const TEXT_DARK = "#1e293b";
const TEXT_MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f1f5f9";

export const EMAIL_LOGO_URL =
  "https://res.cloudinary.com/mcymctsr/image/upload/v1783505369/onepws-6s-auditpro/branding/onepws-logo-email.png";

/**
 * Wraps template body content in a shared, table-based HTML shell for
 * cross-client email compatibility (Outlook/Gmail/Apple Mail all render
 * inconsistently with flexbox/grid, so this intentionally avoids them).
 */
export function wrapEmailLayout(bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{companyName}}</title>
<style>
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; }
    .email-padding { padding: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px 24px;text-align:left;border-bottom:3px solid ${BRAND_RED};">
              <img src="{{logoUrl}}" alt="{{companyName}}" width="140" style="display:block;max-width:140px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:32px;color:${TEXT_DARK};font-size:15px;line-height:1.65;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:left;border-top:1px solid ${BORDER};">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-weight:600;">{{companyName}} &middot; 6S AuditPro</p>
              <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;">This is an automated notification from 6S AuditPro. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr>
    <td style="border-radius:8px;background-color:${BRAND_RED};">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function severityBadge(severityToken = "{{severity}}") {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background-color:#fef2f2;color:${BRAND_RED_DARK};border:1px solid #fecaca;">${severityToken}</span>`;
}

export function infoRow(label: string, valueToken: string) {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:${TEXT_MUTED};font-weight:600;white-space:nowrap;">${label}</td>
    <td style="padding:6px 0 6px 12px;font-size:13px;color:${TEXT_DARK};">${valueToken}</td>
  </tr>`;
}

export function infoTable(rows: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};padding:4px 0;">
    ${rows}
  </table>`;
}
