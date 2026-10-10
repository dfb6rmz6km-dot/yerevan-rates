/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  initDataUnsafe?: { user?: { language_code?: string } };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
