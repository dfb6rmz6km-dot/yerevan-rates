import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { haptic } from "../lib/telegram";

export function FavButton({ active, onToggle, size = "md" }: { active: boolean; onToggle: () => void; size?: "md" | "lg" }) {
  const { t } = useI18n();
  const box = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        haptic(active ? "tap" : "success");
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? t.removeFav : t.addFav}
      className={`relative grid ${box} shrink-0 place-items-center rounded-2xl transition-colors ${
        active ? "bg-rose-50 text-rose-500 ring-1 ring-rose-100" : "bg-white/70 text-ink-400 ring-1 ring-black/[0.04]"
      }`}
    >
      <motion.span
        key={String(active)}
        initial={{ scale: active ? 0.4 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 12 }}
      >
        <Heart className="h-5 w-5" fill={active ? "currentColor" : "none"} strokeWidth={2.2} />
      </motion.span>
      {/* little burst when adding */}
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            key="burst"
            initial={{ scale: 0.4, opacity: 0.55 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-rose-300"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
