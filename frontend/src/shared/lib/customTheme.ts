import { getCustomThemeCSS, writeCustomThemeCSS } from "./api";
import indexCss from "../../index.css?raw";

/**
 * Custom theme support ("Custom" option in Settings -> Appearance).
 *
 * The user stylesheet lives at ~/.refleks/custom.css and fully defines the
 * Custom theme's CSS variables (a single `:root` block), layered over the
 * bundled stylesheet so its values win. The template is generated from the
 * authored `src/index.css` (imported as raw text) so it always mirrors the
 * exact variable set the app ships — no duplicated value list to drift out
 * of sync, and no reliance on CSSOM serialization quirks.
 */

const CUSTOM_THEME_STYLE_ID = "refleks-custom-theme";

const TEMPLATE_HEADER = `/* ============================================================
   RefleK's custom theme
   ============================================================
   This file fully defines the Custom theme. The values below were
   copied from the base theme you had active (Dark by default), so
   the app looks the same until you change something.

   Edit any variable to customize colors, fonts, spacing, scrollbars,
   and more. Variables keep the same names as the built-in theme;
   anything you leave untouched keeps its current value.

   Fonts: system fonts work by family name, e.g.
     --font-body: "Segoe UI", sans-serif;
   Font files on disk (e.g. url("./assets/fonts/...")) do not load —
   only the fonts bundled with the app are available.

   Want the official palettes? The built-in themes live in
   https://github.com/ARm8-2/refleks  (frontend/src/index.css)

   Changes apply the next time the app starts. Use "Regenerate" in
   Settings to restore this default template (this overwrites your
   edits).
   ============================================================ */

`;

/**
 * The base-theme scope currently active on <html> ("custom" never changes
 * the class, so the underlying base theme stays in place).
 */
function activeThemeScope(): string {
  if (document.documentElement.classList.contains("darker")) return ".darker";
  if (document.documentElement.classList.contains("dark")) return ".dark";
  return ":root";
}

/**
 * Extract one theme scope's authored variable declarations. The source is
 * assumed to be well formatted: a `selector { ... }` block whose values
 * contain no braces, and declarations terminated by ";".
 */
function extractVariableBlock(selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block =
    new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(indexCss)?.[1] ?? "";

  const variables = new Map<string, string>();
  const declaration = /(--[\w-]+)\s*:\s*([\s\S]*?);/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(block)) !== null) {
    // Collapse any internal line breaks (e.g. multi-line font stacks) so the
    // generated template stays one declaration per line.
    variables.set(match[1], match[2].trim().replace(/\s*\n\s*/g, " "));
  }
  return variables;
}

/**
 * Inject a custom stylesheet so it layers over the bundled one. An empty
 * string removes the injection.
 */
export function injectCustomTheme(css: string) {
  if (!css) {
    removeCustomTheme();
    return;
  }
  let style = document.getElementById(
    CUSTOM_THEME_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = CUSTOM_THEME_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

/** Remove the injected custom stylesheet, if any. */
export function removeCustomTheme() {
  document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove();
}

/**
 * Build the default custom theme template: a single complete `:root` block.
 * It starts from the shipped `:root` scope (which carries every variable,
 * including fonts and derived sidebar values) and overlays the active base
 * theme's values, so the file both matches the current look and stays
 * complete on its own — no "which block is active" ambiguity for the user.
 */
export function buildCustomThemeTemplate(): string {
  const merged = extractVariableBlock(":root");
  for (const [name, value] of extractVariableBlock(activeThemeScope())) {
    merged.set(name, value);
  }

  const declarations = [...merged.entries()].map(
    ([name, value]) => `  ${name}: ${value};`,
  );
  return `${TEMPLATE_HEADER}:root {\n${declarations.join("\n")}\n}\n`;
}

/**
 * Load the persisted custom stylesheet and inject it. Missing or unreadable
 * files are treated as "no custom theme" (the base theme stays active).
 */
export async function applySavedCustomTheme(): Promise<void> {
  try {
    injectCustomTheme(await getCustomThemeCSS());
  } catch {
    // Fall back to the base theme if the file cannot be read.
  }
}

/**
 * Make sure the custom theme file exists (generating the template on first
 * use) and inject it. Throws when the file cannot be written so callers can
 * surface the failure.
 */
export async function ensureCustomThemeFile(): Promise<void> {
  const existing = await getCustomThemeCSS();
  if (existing) {
    injectCustomTheme(existing);
    return;
  }
  const template = buildCustomThemeTemplate();
  await writeCustomThemeCSS(template);
  injectCustomTheme(template);
}
