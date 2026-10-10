import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { haptic } from "../lib/telegram";

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  aria?: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  className?: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({ options, value, onChange, layoutId, className = "", size = "md" }: Props<T>) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-[7px] text-[13px]";
  return (
    <div className={`segmented ${className}`} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.aria}
            onClick={() => {
              if (!active) {
                haptic("select");
                onChange(o.value);
              }
            }}
            className={`relative flex-1 whitespace-nowrap rounded-[13px] font-semibold transition-colors ${pad} ${
              active ? "text-ink-900" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="pill"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
