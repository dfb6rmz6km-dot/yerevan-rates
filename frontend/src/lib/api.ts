import type { RatesResponse } from "../types";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function request(path: string, init?: RequestInit): Promise<RatesResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as RatesResponse;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchRates = () => request("/api/rates");
export const forceRefresh = () => request("/api/rates/refresh", { method: "POST" });
