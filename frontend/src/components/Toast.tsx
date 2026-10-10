import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ToastData {
  id: number;
  kind: "ok" | "warn";
  text: string;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="glass-card flex items-center gap-2 !rounded-full px-4 py-2 text-[13px] font-semibold"
          >
            {toast.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
