import { motion } from "framer-motion";
import { Clock, Crown, Landmark, MapPin, Store } from "lucide-react";
import { memo, type RefObject } from "react";
import { formatRate, formatRelative, rateOf } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Currency, Mode, Point } from "../types";
import { FavButton } from "./FavButton";

interface Props {
  point: Point;
  index: number;
  currency: Currency;
  mode: Mode;
  best: number | null;
  updatedAt: string | null;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onOpen: (p: Point) => void;
  scrollRoot: RefObject<HTMLElement>;
}

function PointCardImpl({ point, index, currency, mode, best, updatedAt, isFav, onToggleFav, onOpen, scrollRoot }: Props) {
  const { t, lang, locale } = useI18n();
  const value = rateOf(point, currency, mode);
  const isBest = value != null && best != null && value === best;
  const diff = value != null && best != null ? Math.abs(value - best) : null;
  const address = point.address?.[lang] || point.address?.ru || "";
  const Icon = point.type === "bank" ? Landmark : Store;
  const time = point.rate_updated_at || formatRelative(updatedAt, locale, t.justNow);

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 34, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15, root: scrollRoot }}
      transition={{
        type: "spring",
        stiffness: 210,
        damping: 26,
        mass: 0.9,
        delay: Math.min(index, 5) * 0.05,
      }}
      whileTap={{ scale: 0.982 }}
      onClick={() => onOpen(point)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(point)}
      className={`glass-card relative cursor-pointer overflow-hidden p-4 ${isBest ? "ring-2 ring-brand-400/40" : ""}`}
    >
      {isBest && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-brand-400/25 to-sky-300/20 blur-2xl" />
      )}

      <div className="relative flex items-start gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
            point.type === "bank"
              ? "bg-gradient-to-br from-indigo-50 to-sky-50 text-brand-600 ring-1 ring-indigo-100"
              : "bg-gradient-to-br from-amber-50 to-rose-50 text-amber-600 ring-1 ring-amber-100"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-[15.5px] font-bold tracking-tight">{point.name}</h3>
          <p className="mt-1 flex items-start gap-1 text-[12.5px] font-medium leading-snug text-ink-500">
            <MapPin className="mt-[2px] h-3.5 w-3.5 shrink-0 text-ink-400" />
            <span className="line-clamp-2">{address || t.addressUnknown}</span>
          </p>
        </div>
        <FavButton active={isFav} onToggle={() => onToggleFav(point.id)} />
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
            {mode === "buy" ? t.buy : t.sell} · {currency}
          </div>
          <motion.div
            key={`${currency}-${mode}-${value}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="tabular mt-0.5 flex items-baseline gap-1"
          >
            <span className={`text-[30px] font-extrabold leading-none tracking-tight ${value == null ? "text-ink-400" : ""}`}>
              {value == null ? t.noData : formatRate(value, currency, locale)}
            </span>
            {value != null && <span className="text-base font-bold text-ink-400">֏</span>}
          </motion.div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          {isBest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-sky-500 px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-wide text-white shadow-glow">
              <Crown className="h-3 w-3" />
              {t.best}
            </span>
          )}
          {diff != null && diff > 0 && (
            <span className="tabular rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[11px] font-semibold text-ink-500">
              −
              {formatRate(diff, currency, locale)} ֏ {t.fromBest}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-ink-400">
            <Clock className="h-3.5 w-3.5" />
            {time}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export const PointCard = memo(PointCardImpl);
