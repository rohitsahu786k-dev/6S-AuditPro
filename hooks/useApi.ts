"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ApiState<T> = { data?: T; error?: string; loading: boolean };
type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: string };

async function parseApiResponse<T>(res: Response) {
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || json.ok === false) throw new Error(json.error || "Request failed");
  return ("data" in json ? json.data : json) as T;
}

export function useApi<T>(url: string | null) {
  const [state, setState] = useState<ApiState<T>>({ loading: Boolean(url) });
  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!url) {
      setState({ loading: false });
      return;
    }
    const currentRequestId = ++requestId.current;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (currentRequestId !== requestId.current) return;
      if (!res.ok || !json.ok) {
        setState((current) => ({ ...current, loading: false, error: json.error || "Request failed" }));
      } else {
        setState({ loading: false, data: json.data });
      }
    } catch (error) {
      if (currentRequestId !== requestId.current) return;
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Request failed"
      }));
    }
  }, [url]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);
  return { ...state, reload: load };
}

export async function apiPost<T>(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  return parseApiResponse<T>(res);
}

export async function apiPatch<T>(url: string, body: unknown) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return parseApiResponse<T>(res);
}

export async function apiPut<T>(url: string, body: unknown) {
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return parseApiResponse<T>(res);
}

export async function apiDelete<T>(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  return parseApiResponse<T>(res);
}

export async function apiUpload<T>(url: string, body: FormData) {
  const res = await fetch(url, { method: "POST", body });
  return parseApiResponse<T>(res);
}
