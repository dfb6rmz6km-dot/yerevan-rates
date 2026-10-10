import { AnimatePresence, motion } from "framer-motion";
import { Heart, LayoutGrid } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { haptic } from "../lib/telegram";
import type { Tab } from "../types";

export function BottomNav({ tab, onTab, favCount }: { tab: Tab; onTab: (t: Tab) => void; favCount: number }) {
  const { t } = useI18n();
  const items = [
    { id: "list" as const, label: t.tabList, Icon: LayoutGrid },
    { id: "fav" as const, label: t.tabFav, Icon: Heart },
  ];

  return (
    <nav className="glass-bar relative z-30 shrink-0 border-t px-5 pb-[calc(var(--safe-bottom)+8px)] pt-2">
      <div className="mx-auto flex max-w-sm gap-2">
        {items.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!active) {
                  haptic("select");
                  onTab(id);
                }
              }}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2"
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-white/85 shadow-[0_4px_16px_-6px_rgba(30,41,90,.3)] ring-1 ring-black/[0.04]"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">
                <motion.span
                  animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="block"
                >
                  <Icon
                    className={`h-[22px] w-[22px] transition-colors ${active ? "text-brand-600" : "text-ink-400"}`}
                    fill={id === "fav" && active ? "currentColor" : "none"}
                    strokeWidth={2.1}
                  />
                </motion.span>
                <AnimatePresence>
                  {id === "fav" && favCount > 0 && (
                    <motion.span
                      key={favCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 20 }}
                      className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
                    >
                      {favCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={`relative text-[11px] font-semibold ${active ? "text-ink-900" : "text-ink-400"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
