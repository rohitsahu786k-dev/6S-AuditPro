export function getAppUrl() {
  const configuredUrl = process.env.APP_BASE_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_BASE_URL or AUTH_URL is required");
    return "http://localhost:3000";
  }

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid app URL protocol");
    if (url.username || url.password) throw new Error("App URL must not contain credentials");
    return url.origin;
  } catch {
    throw new Error("APP_BASE_URL or AUTH_URL must be a valid HTTP(S) URL");
  }
}

export function getAppLink(path: string) {
  return new URL(path, `${getAppUrl()}/`).toString();
}
