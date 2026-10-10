import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Check, Copy, Landmark, MapPin, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRate, formatRelative } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { haptic, openExternal, tg } from "../lib/telegram";
import { CURRENCIES, type Currency, type Mode, type Point } from "../types";
import { FavButton } from "./FavButton";

interface Props {
  point: Point | null;
  currency: Currency;
  mode: Mode;
  updatedAt: string | null;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onClose: () => void;
}

const FLAG: Record<Currency, string> = { USD: "🇺🇸", EUR: "🇪🇺", RUB: "🇷🇺" };

export function PointSheet({ point, currency, mode, updatedAt, isFav, onToggleFav, onClose }: Props) {
  // Telegram native back button closes the sheet; Escape too.
  useEffect(() => {
    if (!point) return;
    const back = tg?.BackButton;
    back?.show();
    back?.onClick(onClose);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      back?.offClick(onClose);
      back?.hide();
      window.removeEventListener("keydown", onKey);
    };
  }, [point, onClose]);

  return (
    <AnimatePresence>
      {point && (
        <motion.div key="sheet-root" className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <SheetBody
            point={point}
            currency={currency}
            mode={mode}
            updatedAt={updatedAt}
            isFav={isFav}
            onToggleFav={onToggleFav}
            onClose={onClose}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetBody({ point, currency, mode, updatedAt, isFav, onToggleFav, onClose }: Props & { point: Point }) {
  const { t, lang, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const address = point.address?.[lang] || point.address?.ru || "";
  const Icon = point.type === "bank" ? Landmark : Store;
  const hasRates = Object.keys(point.rates).length > 0;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      haptic("success");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-label={point.name}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.05, bottom: 0.7 }}
      onDragEnd={onDragEnd}
      className="no-scrollbar relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-b-0 border-white/80 bg-white/80 px-5 pb-[calc(var(--safe-bottom)+20px)] pt-3 shadow-[0_-20px_60px_-20px_rgba(30,41,90,.35)] backdrop-blur-xl"
    >
      <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-slate-300/80" />

      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-glow">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">
            {point.type === "bank" ? t.bank : t.exchange}
          </div>
          <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{point.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900/[0.05] text-ink-500"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mt-5 flex items-start gap-3 rounded-3xl bg-white/80 p-4 ring-1 ring-black/[0.04]"
      >
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{t.address}</div>
          <div className="mt-0.5 text-[15px] font-semibold leading-snug">{address || t.addressUnknown}</div>
        </div>
        {address && (
          <button
            type="button"
            onClick={copy}
            aria-label={t.copy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900/[0.04] text-ink-500"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="mt-3 overflow-hidden rounded-3xl bg-white/80 ring-1 ring-black/[0.04]"
      >
        <div className="flex items-center justify-between px-4 pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">
          <span>{t.allRates}</span>
          <span className="normal-case tracking-normal">
            {t.rateAsOf} {point.rate_updated_at || formatRelative(updatedAt, locale, t.justNow)}
          </span>
        </div>
        {hasRates ? (
          <table className="tabular mt-1 w-full text-[15px]">
            <thead>
              <tr className="text-[11.5px] font-semibold text-ink-400">
                <th className="px-4 py-2 text-left font-semibold">{t.currency}</th>
                <th className="px-4 py-2 text-right font-semibold">{t.buy}</th>
                <th className="px-4 py-2 text-right font-semibold">{t.sell}</th>
              </tr>
            </thead>
            <tbody>
              {CURRENCIES.map((c) => {
                const r = point.rates[c];
                const sel = c === currency;
                return (
                  <tr key={c} className={sel ? "bg-brand-50/70" : ""}>
                    <td className="px-4 py-2.5 font-bold">
                      <span className="mr-2">{FLAG[c]}</span>
                      {c}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${sel && mode === "buy" ? "text-brand-600" : ""}`}>
                      {formatRate(r?.buy, c, locale)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${sel && mode === "sell" ? "text-brand-600" : ""}`}>
                      {formatRate(r?.sell, c, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-4 pb-4 pt-2 text-sm font-medium text-ink-500">{t.noRateNow}</p>
        )}
        <div className="h-2" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 grid grid-cols-[52px_1fr_52px] items-center gap-2.5"
      >
        {/* empty left column balances the favourite button, so the maps button sits in the centre */}
        <div />
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            haptic("tap");
            openExternal(point.maps_url);
          }}
          className="flex h-[52px] items-center justify-center rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-sky-500 px-4 text-[15px] font-bold text-white shadow-glow"
        >
          {t.openMaps}
        </motion.button>
        <FavButton active={isFav} onToggle={() => onToggleFav(point.id)} size="lg" />
      </motion.div>
    </motion.section>
  );
}
