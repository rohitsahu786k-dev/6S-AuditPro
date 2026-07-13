const PRODUCTION_APP_URL = "https://6s-audit-pro.onepws.com";

export function getAppUrl() {
  const configuredUrl = process.env.APP_BASE_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;

  if (!configuredUrl) return PRODUCTION_APP_URL;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return PRODUCTION_APP_URL;
    return url.origin;
  } catch {
    return PRODUCTION_APP_URL;
  }
}

export function getAppLink(path: string) {
  return new URL(path, `${getAppUrl()}/`).toString();
}
