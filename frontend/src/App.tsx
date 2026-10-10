import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Backdrop } from "./components/Backdrop";
import { BottomNav } from "./components/BottomNav";
import { Header } from "./components/Header";
import { PointCard } from "./components/PointCard";
import { PointSheet } from "./components/PointSheet";
import { EmptyFavorites, LoadError, NothingFound, SkeletonList } from "./components/States";
import { Toast, type ToastData } from "./components/Toast";
import { useFavorites } from "./hooks/useFavorites";
import { useRates } from "./hooks/useRates";
import { bestRate, sortPoints } from "./lib/format";
import { useI18n } from "./lib/i18n";
import { readJSON, writeJSON } from "./lib/storage";
import type { Currency, Mode, Point, Tab } from "./types";

const PREFS_KEY = "yr:prefs";

export default function App() {
  const { t } = useI18n();
  const prefs = useMemo(() => readJSON<{ currency?: Currency; mode?: Mode }>(PREFS_KEY, {}), []);
  const [tab, setTab] = useState<Tab>("list");
  const [currency, setCurrency] = useState<Currency>(prefs.currency ?? "USD");
  const [mode, setMode] = useState<Mode>(prefs.mode ?? "buy");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const scrollRef = useRef<HTMLElement>(null);

  const { data, loading, refreshing, error, refresh, reload } = useRates();
  const { ids: favIds, isFav, toggle } = useFavorites();

  useEffect(() => writeJSON(PREFS_KEY, { currency, mode }), [currency, mode]);

  const points = data?.points ?? [];
  const sorted = useMemo(() => sortPoints(points, currency, mode), [points, currency, mode]);
  const best = useMemo(() => bestRate(points, currency, mode), [points, currency, mode]);

  const visible = useMemo(() => {
    if (tab === "fav") return sorted.filter((p) => favIds.includes(p.id));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) =>
      [p.name, p.address?.ru, p.address?.en].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [tab, sorted, favIds, query]);

  const selected = useMemo(() => points.find((p) => p.id === selectedId) ?? null, [points, selectedId]);
  const openPoint = useCallback((p: Point) => setSelectedId(p.id), []);
  const closePoint = useCallback(() => setSelectedId(null), []);

  const showToast = (kind: ToastData["kind"], text: string) => {
    const id = Date.now();
    setToast({ id, kind, text });
    setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 2600);
  };

  const onRefresh = async () => {
    const r = await refresh();
    showToast(r === "ok" ? "ok" : "warn", r === "ok" ? t.refreshed : t.refreshFailed);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const showStaleBanner = data && data.stale && data.source !== "seed";

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <Backdrop />
      <Header
        currency={currency}
        mode={mode}
        onCurrency={setCurrency}
        onMode={setMode}
        onRefresh={onRefresh}
        refreshing={refreshing}
        data={data}
      />

      <div className="relative min-h-0 flex-1">
      <Toast toast={toast} />
      <main ref={scrollRef} className="no-scrollbar h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-xl px-4 pb-8 pt-4">
          {/* No AnimatePresence mode="wait" here: its exit could hang after favourites were removed
              inside the leaving tab, and the next tab then never mounted (blank screen). */}
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
              {tab === "list" && (
                <div className="mb-3 flex items-center gap-2">
                  <label className="glass-card flex h-11 flex-1 items-center gap-2 !rounded-2xl px-3.5">
                    <Search className="h-[18px] w-[18px] shrink-0 text-ink-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t.search}
                      className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-ink-400"
                      enterKeyHint="search"
                    />
                    <AnimatePresence>
                      {query && (
                        <motion.button
                          type="button"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          onClick={() => setQuery("")}
                          aria-label="clear"
                          className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/[0.07] text-ink-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </label>
                </div>
              )}

              {tab === "list" && data && (
                <div className="mb-3 flex items-center justify-between px-1 text-[12px] font-semibold text-ink-400">
                  <span>{t.points(visible.length)}</span>
                  {showStaleBanner && <span className="truncate pl-3 text-amber-600">{t.staleHint}</span>}
                </div>
              )}

              {loading && !data ? (
                <SkeletonList />
              ) : error && !data ? (
                <LoadError onRetry={reload} />
              ) : tab === "fav" && visible.length === 0 ? (
                <EmptyFavorites onBrowse={() => switchTab("list")} />
              ) : visible.length === 0 ? (
                <NothingFound />
              ) : (
                <LayoutGroup>
                  <div className="space-y-3">
                      {visible.map((p, i) => (
                        <PointCard
                          key={p.id}
                          point={p}
                          index={i}
                          currency={currency}
                          mode={mode}
                          best={best}
                          updatedAt={data?.updated_at ?? null}
                          isFav={isFav(p.id)}
                          onToggleFav={toggle}
                          onOpen={openPoint}
                          scrollRoot={scrollRef}
                        />
                      ))}
                  </div>
                </LayoutGroup>
              )}
          </motion.div>
        </div>
      </main>
      </div>

      <BottomNav tab={tab} onTab={switchTab} favCount={favIds.length} />

      <PointSheet
        point={selected}
        currency={currency}
        mode={mode}
        updatedAt={data?.updated_at ?? null}
        isFav={selected ? isFav(selected.id) : false}
        onToggleFav={toggle}
        onClose={closePoint}
      />
    </div>
  );
}
