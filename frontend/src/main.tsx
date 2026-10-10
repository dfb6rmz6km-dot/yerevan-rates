import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { initTelegram } from "./lib/telegram";

initTelegram();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <App />
      </I18nProvider>
    </MotionConfig>
  </StrictMode>,
);
