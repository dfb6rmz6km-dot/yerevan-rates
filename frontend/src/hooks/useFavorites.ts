import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "../lib/storage";

/**
 * Favourites live in localStorage. A tiny external store keeps every component in sync
 * instantly, and the `storage` event syncs other tabs/windows of the same origin.
 */
const KEY = "yr:favorites";
const listeners = new Set<() => void>();

function load(): string[] {
  const v = readJSON<unknown>(KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

let snapshot: string[] = load();

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      snapshot = load();
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleFavorite(id: string) {
  snapshot = snapshot.includes(id) ? snapshot.filter((x) => x !== id) : [id, ...snapshot];
  writeJSON(KEY, snapshot);
  emit();
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  const set = useMemo(() => new Set(ids), [ids]);
  const isFav = useCallback((id: string) => set.has(id), [set]);
  return { ids, isFav, toggle: toggleFavorite };
}
