import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRates, forceRefresh } from "../lib/api";
import { haptic } from "../lib/telegram";
import type { RatesResponse } from "../types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RefreshResult = "ok" | "stale" | "error";

export function useRates() {
  const [data, setData] = useState<RatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchRates());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (busy.current) return "ok";
    busy.current = true;
    setRefreshing(true);
    haptic("tap");
    const started = Date.now();
    let result: RefreshResult = "ok";
    try {
      const d = await forceRefresh();
      setData(d);
      setError(null);
      result = d.error ? "stale" : "ok";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      result = "error";
    } finally {
      // keep the spinner for a moment so the animation never "flashes"
      await sleep(Math.max(0, 800 - (Date.now() - started)));
      setRefreshing(false);
      setLoading(false);
      busy.current = false;
    }
    haptic(result === "ok" ? "success" : "error");
    return result;
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // While the backend is still serving demo/seed data, poll more often for the first real scrape.
  useEffect(() => {
    if (data?.source !== "seed") return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [data?.source, load]);

  return { data, loading, refreshing, error, refresh, reload: load };
}
