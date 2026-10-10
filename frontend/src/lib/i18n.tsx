import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "../types";
import { readJSON, writeJSON } from "./storage";
import { telegramLang } from "./telegram";

const ru = {
  appTitle: "Обменники Еревана",
  appSubtitle: "Банки и обменники",
  buy: "Покупка",
  sell: "Продажа",
  buyHint: "Банк покупает у вас валюту",
  sellHint: "Банк продаёт вам валюту",
  tabList: "Главная",
  tabFav: "Избранное",
  emptyFavTitle: "Тут будут ваши избранные обменники",
  emptyFavHint: "Нажмите на сердечко на карточке, чтобы быстро возвращаться к любимым точкам",
  goToList: "К списку",
  best: "Лучший курс",
  fromBest: "от лучшего",
  openMaps: "Открыть в Google Картах",
  address: "Адрес",
  addressUnknown: "Точный адрес уточняется",
  noData: "Нет данных",
  noRateNow: "Rate.am сейчас не публикует курс этой точки",
  search: "Поиск банка или обменника",
  nothingFound: "Ничего не найдено",
  refresh: "Обновить курсы",
  sourceLive: "Rate.am · онлайн",
  sourceCache: "Сохранённые данные",
  sourceSeed: "Демо-курсы · ждём Rate.am",
  staleHint: "Rate.am недоступен — показаны последние сохранённые курсы",
  refreshFailed: "Не удалось обновить — показаны сохранённые курсы",
  refreshed: "Курсы обновлены",
  errorTitle: "Не удалось загрузить курсы",
  errorHint: "Проверьте подключение к интернету и попробуйте снова",
  retry: "Повторить",
  bank: "Банк",
  exchange: "Обменник",
  allRates: "Все курсы",
  currency: "Валюта",
  phone: "Телефон",
  rateAsOf: "Курс от",
  updated: "Обновлено",
  addFav: "Добавить в избранное",
  removeFav: "Убрать из избранного",
  inFav: "В избранном",
  close: "Закрыть",
  copy: "Скопировать адрес",
  copied: "Скопировано",
  points: (n: number) => `${n} ${plural(n, ["точка", "точки", "точек"])}`,
  justNow: "только что",
};

type Dict = typeof ru;

const en: Dict = {
  appTitle: "Yerevan Rates",
  appSubtitle: "Banks & exchange points",
  buy: "Buy",
  sell: "Sell",
  buyHint: "The bank buys currency from you",
  sellHint: "The bank sells currency to you",
  tabList: "Home",
  tabFav: "Favorites",
  emptyFavTitle: "Your favorite exchange points will appear here",
  emptyFavHint: "Tap the heart on any card to keep your go-to places one tap away",
  goToList: "Browse list",
  best: "Best rate",
  fromBest: "from best",
  openMaps: "Open in Google Maps",
  address: "Address",
  addressUnknown: "Exact address to be confirmed",
  noData: "No data",
  noRateNow: "Rate.am doesn't publish a rate for this point right now",
  search: "Search bank or exchange point",
  nothingFound: "Nothing found",
  refresh: "Refresh rates",
  sourceLive: "Rate.am · live",
  sourceCache: "Saved data",
  sourceSeed: "Demo rates · waiting for Rate.am",
  staleHint: "Rate.am is unavailable — showing the last saved rates",
  refreshFailed: "Couldn't refresh — showing saved rates",
  refreshed: "Rates updated",
  errorTitle: "Couldn't load rates",
  errorHint: "Check your connection and try again",
  retry: "Try again",
  bank: "Bank",
  exchange: "Exchange point",
  allRates: "All rates",
  currency: "Currency",
  phone: "Phone",
  rateAsOf: "Rate as of",
  updated: "Updated",
  addFav: "Add to favorites",
  removeFav: "Remove from favorites",
  inFav: "In favorites",
  close: "Close",
  copy: "Copy address",
  copied: "Copied",
  points: (n: number) => `${n} ${n === 1 ? "point" : "points"}`,
  justNow: "just now",
};

function plural(n: number, forms: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

const DICTS: Record<Lang, Dict> = { ru, en };
const KEY = "yr:lang";

interface I18n {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  locale: string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  const saved = readJSON<Lang | null>(KEY, null);
  if (saved === "ru" || saved === "en") return saved;
  return telegramLang() ?? (navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en");
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeJSON(KEY, l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(
    () => ({ lang, t: DICTS[lang], setLang, locale: lang === "ru" ? "ru-RU" : "en-US" }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
