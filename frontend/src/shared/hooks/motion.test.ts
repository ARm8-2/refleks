import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("reads the system reduced-motion media query", async () => {
    const mediaQuery = { matches: true } as MediaQueryList;
    const matchMedia = vi.fn(() => mediaQuery);
    vi.stubGlobal("window", { matchMedia });

    const { prefersReducedMotion } = await import("./motion");

    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
  });

  it("defaults to motion when the media query API is unavailable", async () => {
    vi.stubGlobal("window", {});

    const { prefersReducedMotion } = await import("./motion");

    expect(prefersReducedMotion()).toBe(false);
  });
});
