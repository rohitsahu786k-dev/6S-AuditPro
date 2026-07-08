export function assertCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw Object.assign(new Error("CRON_SECRET is not configured"), { status: 500 });
  const provided = request.headers.get("x-cron-secret");
  if (provided !== secret) throw Object.assign(new Error("Unauthorized"), { status: 401 });
}
