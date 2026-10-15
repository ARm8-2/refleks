// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalMatchMedia = Object.getOwnPropertyDescriptor(
  window,
  "matchMedia",
);
let systemPrefersReducedMotion = true;
let mediaChangeListeners: Set<() => void>;
let mediaQuery: MediaQueryList;

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  systemPrefersReducedMotion = true;
  mediaChangeListeners = new Set();
  mediaQuery = {
    get matches() {
      return systemPrefersReducedMotion;
    },
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      mediaChangeListeners.add(listener as unknown as () => void);
    },
    removeEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      mediaChangeListeners.delete(listener as unknown as () => void);
    },
  } as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQuery),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete document.documentElement.dataset.motionPreference;
  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
});

describe("reduced motion preference", () => {
  it("follows the operating system in System mode", async () => {
    const { prefersReducedMotion } = await import("./motion");

    expect(prefersReducedMotion()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
  });

  it("reacts when the system preference changes", async () => {
    const { usePrefersReducedMotion } = await import("./motion");
    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
    act(() => {
      systemPrefersReducedMotion = false;
      mediaChangeListeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
  });

  it("allows explicit reduced and full motion overrides", async () => {
    const { setMotionPreference } = await import("../lib/motion");
    const { usePrefersReducedMotion } = await import("./motion");
    const { result } = renderHook(() => usePrefersReducedMotion());

    act(() => setMotionPreference("full"));
    expect(result.current).toBe(false);
    expect(document.documentElement.dataset.motionPreference).toBe("full");

    act(() => setMotionPreference("reduced"));
    expect(result.current).toBe(true);
    expect(document.documentElement.dataset.motionPreference).toBe("reduced");
  });

  it("defaults to full motion when the media query API is unavailable", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });
    const { prefersReducedMotion } = await import("./motion");

    expect(prefersReducedMotion()).toBe(false);
  });
});
