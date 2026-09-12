import { useEffect, useRef, useState } from "react";

type InViewCallback = (inView: boolean) => void;

type ObserverEntry = {
  observer: IntersectionObserver;
  listeners: Map<Element, InViewCallback>;
};

// A single IntersectionObserver is shared per root margin. Benchmark tables can
// mount hundreds of rows at once, and one observer per row would be needlessly
// expensive when a single observer is built to track many targets.
const observers = new Map<string, ObserverEntry>();
const supported = typeof IntersectionObserver !== "undefined";

// Treat an element as visible slightly before it reaches the viewport edge so
// reveal animations have already started by the time it is actually on screen.
const DEFAULT_ROOT_MARGIN = "96px 0px";

function getObserver(rootMargin: string): ObserverEntry | null {
  if (!supported) return null;

  const existing = observers.get(rootMargin);
  if (existing) return existing;

  const listeners = new Map<Element, InViewCallback>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        listeners.get(entry.target)?.(entry.isIntersecting);
      }
    },
    { root: null, rootMargin, threshold: 0 },
  );

  const entry: ObserverEntry = { observer, listeners };
  observers.set(rootMargin, entry);
  return entry;
}

export type UseInViewOptions = {
  rootMargin?: string;
  /** Report true permanently once the element has been seen. */
  once?: boolean;
};

/**
 * Tracks whether the referenced element is inside the viewport (including
 * clipping by scrollable ancestors such as the page's inner scroll containers).
 *
 * The returned `ref` is a callback ref rather than an object ref: the target
 * element is not always present on the component's first render (for example a
 * chart that only mounts once a modal opens), and an object ref would leave the
 * observer attached to nothing, so the element would never be reported visible.
 */
export function useInView<T extends Element>(
  options: UseInViewOptions = {},
): { ref: (element: T | null) => void; inView: boolean } {
  const { rootMargin = DEFAULT_ROOT_MARGIN, once = false } = options;
  const [element, setElement] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const seenRef = useRef(false);

  useEffect(() => {
    if (!element) return;

    const entry = getObserver(rootMargin);
    if (!entry) {
      // No IntersectionObserver support: treat everything as visible rather
      // than freezing the UI.
      setInView(true);
      return;
    }

    const listener: InViewCallback = (isInView) => {
      if (isInView) {
        seenRef.current = true;
        setInView(true);
        if (once) {
          entry.observer.unobserve(element);
          entry.listeners.delete(element);
        }
        return;
      }
      if (!once || !seenRef.current) {
        setInView(false);
      }
    };

    entry.listeners.set(element, listener);
    entry.observer.observe(element);

    return () => {
      entry.observer.unobserve(element);
      entry.listeners.delete(element);
    };
  }, [element, rootMargin, once]);

  return { ref: setElement, inView };
}
