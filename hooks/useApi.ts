"use client";

import { useCallback, useEffect, useState } from "react";

type ApiState<T> = { data?: T; error?: string; loading: boolean };

export function useApi<T>(url: string) {
  const [state, setState] = useState<ApiState<T>>({ loading: true });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: undefined }));
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) setState({ loading: false, error: json.error || "Request failed" });
    else setState({ loading: false, data: json.data });
  }, [url]);

  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: load };
}

export async function apiPost<T>(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Request failed");
  return json.data as T;
}

export async function apiPatch<T>(url: string, body: unknown) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Request failed");
  return json.data as T;
}
