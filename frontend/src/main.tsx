import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { resolveStartupLanguage } from "./i18n/bootstrap";
import { initializeI18n } from "./i18n";
import Root from "./Root";
import "./index.css";
import { getSettings, updateSettings } from "./shared/lib/api";

const container = document.getElementById("root");

async function bootstrap() {
  const language = await resolveStartupLanguage({
    readSettings: getSettings,
    writeSettings: updateSettings,
    getSystemLanguage: () => navigator.language,
  });
  await initializeI18n(language);

  createRoot(container!).render(
    <StrictMode>
      <HashRouter basename={"/"}>
        <Root />
      </HashRouter>
    </StrictMode>,
  );
}

void bootstrap();
