import type { Lang } from "../types";

export const tg: TelegramWebApp | undefined =
  typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

const BG = "#f4f6fb";

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.(BG);
    tg.setBackgroundColor?.(BG);
    tg.setBottomBarColor?.(BG);
    tg.disableVerticalSwipes?.(); // our list scrolls; don't let it collapse the mini app
  } catch {
    /* older clients */
  }
}

export function haptic(kind: "tap" | "select" | "success" | "error") {
  const h = tg?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === "tap") h.impactOccurred("light");
    else if (kind === "select") h.selectionChanged();
    else h.notificationOccurred(kind);
  } catch {
    /* ignore */
  }
}

/** Opens a URL outside the mini app (Google Maps app / browser). */
export function openExternal(url: string) {
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

export function telegramLang(): Lang | null {
  const code = tg?.initDataUnsafe?.user?.language_code;
  if (!code) return null;
  return /^(ru|uk|be|kk|hy)/i.test(code) ? "ru" : "en";
}
