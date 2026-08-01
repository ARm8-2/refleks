import { STORAGE_KEYS } from "./storageKeys";

export const THEMES = ["dark", "darker", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const FONTS = [
  {
    id: "montserrat",
    label: "Montserrat",
    stack: "var(--font-stack-montserrat)",
  },
  { id: "inter", label: "Inter", stack: "var(--font-stack-inter)" },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono UI",
    stack: "var(--font-stack-jetbrains-mono)",
  },
] as const;
export type Font = (typeof FONTS)[number]["id"];

export const THEME_CHANGED_EVENT = "refleks-theme-changed";
export const FONT_CHANGED_EVENT = "refleks-font-changed";

const THEME_STORAGE_KEY = STORAGE_KEYS.theme;
const FONT_STORAGE_KEY = STORAGE_KEYS.font;

const THEME_CLASSES: Record<Theme, string | null> = {
  dark: "dark",
  darker: "darker",
  light: null,
};

export const THEME_SELECTORS: Record<Theme, string> = {
  light: "",
  dark: ".dark",
  darker: ".darker",
};

export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_FONT: Font = "montserrat";

export function getFontStack(font: Font): string {
  const found = FONTS.find((f) => f.id === font);
  return found?.stack || FONTS[0].stack;
}

function updateFontClasses(font: Font) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  // Remove any existing font-* class
  FONTS.forEach((f) => {
    const cls = `font-${f.id}`;
    root.classList.remove(cls);
    body?.classList.remove(cls);
  });
  const cls = `font-${font}`;
  root.classList.add(cls);
  body?.classList.add(cls);
}

export function getSavedTheme(): Theme {
  const v = (
    localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
  ).toLowerCase();
  return (THEMES as readonly string[]).includes(v)
    ? (v as Theme)
    : DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const activeThemeClasses = Object.values(THEME_CLASSES).filter(
    (v): v is string => !!v,
  );
  if (activeThemeClasses.length > 0) {
    root.classList.remove(...activeThemeClasses);
  }

  const nextClass = THEME_CLASSES[theme];
  if (nextClass) {
    root.classList.add(nextClass);
  }

  root.dataset.theme = theme;

  try {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGED_EVENT, { detail: { theme } }),
    );
  } catch {
    // ignore in non-browser contexts
  }
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function getSavedFont(): Font {
  const v = (
    localStorage.getItem(FONT_STORAGE_KEY) || DEFAULT_FONT
  ).toLowerCase();
  return (FONTS.map((f) => f.id) as readonly string[]).includes(v)
    ? (v as Font)
    : DEFAULT_FONT;
}

export function applyFont(font: Font) {
  if (typeof document === "undefined") return;
  const stack = getFontStack(font);
  const root = document.documentElement;

  // Update CSS variable for components that use it
  root.style.setProperty("--font-body", stack);

  // Update classes on html/body to force font change via CSS
  updateFontClasses(font);

  try {
    window.dispatchEvent(
      new CustomEvent(FONT_CHANGED_EVENT, { detail: { font, stack } }),
    );
  } catch {
    // ignore in non-browser contexts
  }
}

export function setFont(font: Font) {
  localStorage.setItem(FONT_STORAGE_KEY, font);
  applyFont(font);
}

// --- Token helpers ---

export function getCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined")
    return fallback;
  try {
    const css = getComputedStyle(document.documentElement);
    const val = css.getPropertyValue(name)?.trim();
    return val || fallback;
  } catch {
    return fallback;
  }
}

function parseColor(c: string): [number, number, number] | null {
  if (!c) return null;
  const s = c.trim();
  // hex
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((v) => Number.isFinite(v))) return [r, g, b];
    }
  }
  // rgb / rgba
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1]
      .split(",")
      .map((p) => parseFloat(p.trim()))
      .filter((v) => !Number.isNaN(v));
    if (parts.length >= 3)
      return [parts[0], parts[1], parts[2]] as [number, number, number];
  }
  return null;
}

export function colorWithAlpha(
  color: string,
  alpha: number,
  fallback: string,
): string {
  const rgb = parseColor(color) || parseColor(fallback);
  if (!rgb) return fallback;
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function cssColorToRGB(
  color: string,
  fallback: [number, number, number],
): [number, number, number] {
  const parsed = parseColor(color);
  if (parsed) return parsed;
  return fallback;
}
