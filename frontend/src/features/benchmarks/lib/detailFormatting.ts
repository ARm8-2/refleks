export { getScenarioName } from "@/shared/lib";
import { getActiveLocaleFormatters } from "@/i18n";
import { MISSING_STR } from "./detailConstants";

type RGB = { r: number; g: number; b: number };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function resolveCssColor(color: string): string {
  const trimmed = color.trim();
  if (typeof window === "undefined") return trimmed;

  const match = trimmed.match(/^var\((--[^)\s]+)\)$/);
  if (!match) return trimmed;

  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();
  return resolved || trimmed;
}

function parseHexColor(color: string): RGB | null {
  const hex = color.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  return null;
}

function parseRgbColor(color: string): RGB | null {
  const match = color.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (!match) return null;

  const r = Math.max(0, Math.min(255, Number(match[1])));
  const g = Math.max(0, Math.min(255, Number(match[2])));
  const b = Math.max(0, Math.min(255, Number(match[3])));
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b))
    return null;
  return { r, g, b };
}

function parseColorToRGB(color: string): RGB | null {
  return parseHexColor(color) ?? parseRgbColor(color);
}

function relativeLuminance({ r, g, b }: RGB): number {
  const toLinear = (value: number) => {
    const srgb = value / 255;
    if (srgb <= 0.04045) return srgb / 12.92;
    return ((srgb + 0.055) / 1.055) ** 2.4;
  };

  const rr = toLinear(r);
  const gg = toLinear(g);
  const bb = toLinear(b);
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (hh >= 0 && hh < 1) [rn, gn, bn] = [c, x, 0];
  else if (hh < 2) [rn, gn, bn] = [x, c, 0];
  else if (hh < 3) [rn, gn, bn] = [0, c, x];
  else if (hh < 4) [rn, gn, bn] = [0, x, c];
  else if (hh < 5) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  const m = l - c / 2;
  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}

function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function adjustColorForTheme(
  color: string | undefined,
  backgroundColor = "var(--surface)",
  strength = 0.92,
): string {
  const sourceColor = resolveCssColor(color?.trim() || "var(--primary)");
  const bgColor = resolveCssColor(backgroundColor);
  const sourceRgb = parseColorToRGB(sourceColor);
  const bgRgb = parseColorToRGB(bgColor);
  if (!sourceRgb || !bgRgb) return color?.trim() || "var(--primary)";

  const sourceHsl = rgbToHsl(sourceRgb);
  const bgLum = relativeLuminance(bgRgb);
  const targetLightness = bgLum >= 0.5 ? 0.4 : 0.7;
  const adjustedLightness = clamp(
    sourceHsl.l + (targetLightness - sourceHsl.l) * clamp(strength, 0, 1),
    0.18,
    0.82,
  );
  return rgbToCss(hslToRgb({ ...sourceHsl, l: adjustedLightness }));
}

export function formatNumber(
  value: unknown,
  decimals = 2,
  trimTrailingZeros = true,
): string {
  if (value == null || value === "") return MISSING_STR;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return MISSING_STR;

  return getActiveLocaleFormatters().numberFormatter({
    minimumFractionDigits: trimTrailingZeros ? 0 : decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(number);
}

export function computeFillColor(
  achievedRank: number | undefined | null,
  rankDefs: Array<{ color?: string }>,
  fallback = "var(--surface-muted-foreground)",
): string {
  const achieved = Number(achievedRank || 0);
  if (!achieved || achieved <= 0) return fallback;

  const lastIndex = Math.max(
    0,
    Math.min((rankDefs?.length ?? 0) - 1, achieved - 1),
  );
  return rankDefs?.[lastIndex]?.color ?? fallback;
}

export function cellFill(
  index: number,
  score: number,
  thresholds: number[],
): number {
  const maxIndex = thresholds?.length ?? 0;
  if (maxIndex < 2) return 0;

  const previous = thresholds[index] ?? 0;
  const next = thresholds[index + 1] ?? previous;

  if (next <= previous) return Number(score ?? 0) >= next ? 1 : 0;

  const fraction = (Number(score ?? 0) - previous) / (next - previous);
  return Math.max(0, Math.min(1, fraction));
}

export function normalizedRankProgress(
  scenarioRank: number,
  score: number,
  thresholds: number[],
): number {
  const count = thresholds?.length ?? 0;
  const maxRank = count > 0 ? count - 1 : 0;
  if (maxRank <= 0) return 0;

  const rank = Math.max(0, Math.min(maxRank, Number(scenarioRank || 0)));

  if (rank <= 0) {
    const previous = thresholds[0] ?? 0;
    const next = thresholds[1] ?? previous;
    const denominator = next - previous;
    if (denominator <= 0) return 0;

    const fraction = Math.max(
      0,
      Math.min(1, (Number(score || 0) - previous) / denominator),
    );
    return fraction * (1 / maxRank);
  }

  if (rank >= maxRank) return 1;

  const previous = thresholds[rank] ?? 0;
  const next = thresholds[rank + 1] ?? previous;
  if (next <= previous) return rank / maxRank;

  const fraction = Math.max(
    0,
    Math.min(1, (Number(score || 0) - previous) / (next - previous)),
  );
  return (rank - 1) / maxRank + fraction * (1 / maxRank);
}
