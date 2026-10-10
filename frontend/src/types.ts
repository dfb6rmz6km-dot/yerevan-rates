export type Currency = "USD" | "EUR" | "RUB";
export type Mode = "buy" | "sell";
export type Lang = "ru" | "en";
export type Tab = "list" | "fav";

export const CURRENCIES: Currency[] = ["USD", "EUR", "RUB"];

export interface Rate {
  buy: number | null;
  sell: number | null;
}

export interface Point {
  id: string;
  name: string;
  type: "bank" | "exchange";
  address: { ru: string; en: string } | null;
  lat: number | null;
  lng: number | null;
  maps_url: string;
  phone: string | null;
  rates: Partial<Record<Currency, Rate>>;
  rate_updated_at: string | null;
  known: boolean;
}

export interface RatesResponse {
  source: "live" | "cache" | "seed";
  stale: boolean;
  updated_at: string | null;
  fetched_at: string;
  error: string | null;
  points: Point[];
}
