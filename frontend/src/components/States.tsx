import { motion } from "framer-motion";
import { Heart, SearchX, Sparkles, WifiOff } from "lucide-react";
import { useI18n } from "../lib/i18n";

export function EmptyFavorites({ onBrowse }: { onBrowse: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      className="flex flex-col items-center px-6 pb-10 pt-16 text-center"
    >
      <div className="relative">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="glass-card grid h-24 w-24 place-items-center !rounded-[30px]"
        >
          <Heart className="h-10 w-10 text-rose-400" strokeWidth={1.8} />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.25, 1], rotate: [0, 15, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.6, repeat: Infinity }}
          className="absolute -right-3 -top-2 text-brand-400"
        >
          <Sparkles className="h-6 w-6" />
        </motion.div>
      </div>
      <h2 className="mt-7 max-w-[17rem] text-[19px] font-extrabold leading-snug tracking-tight">{t.emptyFavTitle}</h2>
      <p className="mt-2 max-w-[18rem] text-[13.5px] font-medium leading-relaxed text-ink-500">{t.emptyFavHint}</p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onBrowse}
        className="mt-6 rounded-2xl bg-ink-900 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,.6)]"
      >
        {t.goToList}
      </motion.button>
    </motion.div>
  );
}

export function NothingFound() {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-ink-400">
      <SearchX className="h-9 w-9" strokeWidth={1.8} />
      <p className="mt-3 text-sm font-semibold">{t.nothingFound}</p>
    </motion.div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card mt-6 flex flex-col items-center px-6 py-10 text-center"
    >
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-50 text-amber-500 ring-1 ring-amber-100">
        <WifiOff className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-extrabold">{t.errorTitle}</h2>
      <p className="mt-1 text-sm font-medium text-ink-500">{t.errorHint}</p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onRetry}
        className="mt-5 rounded-2xl bg-ink-900 px-5 py-3 text-sm font-bold text-white"
      >
        {t.retry}
      </motion.button>
    </motion.div>
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="glass-card relative overflow-hidden p-4"
        >
          <div className="flex gap-3">
            <div className="h-11 w-11 rounded-2xl bg-slate-200/70" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-2/5 rounded-full bg-slate-200/80" />
              <div className="h-3 w-3/4 rounded-full bg-slate-200/60" />
            </div>
          </div>
          <div className="mt-5 h-7 w-1/3 rounded-xl bg-slate-200/70" />
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </motion.div>
      ))}
    </div>
  );
}
