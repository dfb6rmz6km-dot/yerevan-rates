import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRelative } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Currency, Mode, RatesResponse } from "../types";
import { Segmented } from "./Segmented";

interface Props {
  currency: Currency;
  mode: Mode;
  onCurrency: (c: Currency) => void;
  onMode: (m: Mode) => void;
  onRefresh: () => void;
  refreshing: boolean;
  data: RatesResponse | null;
}

const SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", RUB: "₽" };

export function Header({ currency, mode, onCurrency, onMode, onRefresh, refreshing, data }: Props) {
  const { t, lang, setLang } = useI18n();

  return (
    <header className="glass-bar relative z-30 shrink-0 border-b px-4 pb-3 pt-[calc(var(--safe-top)+14px)]">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <motion.div
              initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-400 to-sky-400 text-lg font-bold text-white shadow-glow"
            >
              ֏
            </motion.div>
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={lang}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-tight">{t.appTitle}</h1>
                  <p className="truncate text-xs font-medium text-ink-500">{t.appSubtitle}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Segmented
              size="sm"
              layoutId="lang-pill"
              value={lang}
              onChange={setLang}
              options={[
                { value: "ru", label: "RU", aria: "Русский" },
                { value: "en", label: "EN", aria: "English" },
              ]}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={onRefresh}
              disabled={refreshing}
              aria-label={t.refresh}
              title={t.refresh}
              className="glass-chip grid h-9 w-9 place-items-center text-ink-700 shadow-glass disabled:opacity-100"
            >
              <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? "animate-spinsmooth text-brand-500" : ""}`} />
            </motion.button>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Segmented
            className="min-w-0 flex-1"
            layoutId="currency-pill"
            value={currency}
            onChange={onCurrency}
            options={(["USD", "EUR", "RUB"] as Currency[]).map((c) => ({
              value: c,
              label: c,
              aria: `${c} ${SYMBOL[c]}`,
            }))}
          />
          <Segmented
            className="min-w-0 flex-1"
            layoutId="mode-pill"
            value={mode}
            onChange={onMode}
            options={[
              { value: "buy", label: t.buy, aria: t.buyHint },
              { value: "sell", label: t.sell, aria: t.sellHint },
            ]}
          />
        </div>

        <StatusLine data={data} mode={mode} />
      </div>

      {/* indeterminate progress line while refreshing */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-brand-500 to-transparent"
              animate={{ x: ["-100%", "300%"] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function StatusLine({ data, mode }: { data: RatesResponse | null; mode: Mode }) {
  const { t, locale } = useI18n();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const source = data?.source;
  const dot = !data
    ? "bg-slate-300"
    : source === "live" && !data.stale
      ? "bg-emerald-500"
      : source === "seed"
        ? "bg-slate-400"
        : "bg-amber-500";
  const label = !data ? "…" : source === "live" ? t.sourceLive : source === "seed" ? t.sourceSeed : t.sourceCache;

  return (
    <div className="mt-2.5 flex items-center justify-between gap-2 text-[11.5px] font-medium text-ink-500">
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          {source === "live" && !data?.stale && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
        </span>
        <span className="truncate">{label}</span>
        {data?.stale && source !== "seed" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
      </span>
      <span className="min-w-0 truncate text-right">
        {mode === "buy" ? t.buyHint : t.sellHint}
        {data?.updated_at ? ` · ${formatRelative(data.updated_at, locale, t.justNow)}` : ""}
      </span>
    </div>
  );
}
