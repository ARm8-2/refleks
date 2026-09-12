import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import Root from "./Root";
import { applySavedCustomTheme } from "./shared/lib/customTheme";
import { applyTheme, getSavedTheme } from "./shared/lib/theme";
import "./index.css";

/**
 * Bootstrap the UI before the first render so the correct theme (including a
 * custom user stylesheet) is applied with no flash of the default theme.
 * The custom stylesheet is fetched asynchronously; on failure the app simply
 * keeps the selected base theme.
 */
async function bootstrap() {
  const theme = getSavedTheme();
  applyTheme(theme);
  if (theme === "custom") {
    await applySavedCustomTheme();
  }

  const container = document.getElementById("root");

  createRoot(container!).render(
    <StrictMode>
      <HashRouter basename={"/"}>
        <Root />
      </HashRouter>
    </StrictMode>,
  );
}

void bootstrap();
