import type { Currency, Mode, Point } from "../types";

const TZ = "Asia/Yerevan";

export function formatRate(value: number | null | undefined, currency: Currency, locale: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency === "RUB" ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatRelative(iso: string | null, locale: string, justNow: string, now = Date.now()) {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMin = Math.round((now - date.getTime()) / 60_000);
  if (diffMin < 1) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffMin < 60 * 12) return rtf.format(-Math.round(diffMin / 60), "hour");
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function formatClock(iso: string | null, locale: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(iso),
  );
}

export function rateOf(p: Point, currency: Currency, mode: Mode): number | null {
  return p.rates[currency]?.[mode] ?? null;
}

/** In both modes the highest rate is shown first and counts as the best one. */
export function sortPoints(points: Point[], currency: Currency, mode: Mode): Point[] {
  return [...points].sort((a, b) => {
    const ra = rateOf(a, currency, mode);
    const rb = rateOf(b, currency, mode);
    if (ra == null && rb == null) return a.name.localeCompare(b.name);
    if (ra == null) return 1;
    if (rb == null) return -1;
    return ra === rb ? a.name.localeCompare(b.name) : rb - ra;
  });
}

export function bestRate(points: Point[], currency: Currency, mode: Mode): number | null {
  const values = points.map((p) => rateOf(p, currency, mode)).filter((v): v is number => v != null);
  if (!values.length) return null;
  return Math.max(...values);
}
