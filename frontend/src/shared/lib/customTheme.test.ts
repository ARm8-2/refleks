import { afterEach, describe, expect, it, vi } from "vitest";
import { injectCustomTheme } from "./customTheme";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("injectCustomTheme", () => {
  it("migrates legacy palette variable names before applying custom CSS", () => {
    const inserted: Array<{ id: string; textContent: string | null }> = [];
    const documentMock = {
      getElementById: vi.fn(() => null),
      createElement: vi.fn(() => ({ id: "", textContent: "" })),
      head: {
        appendChild: vi.fn(
          (style: { id: string; textContent: string | null }) => {
            inserted.push(style);
          },
        ),
      },
    } as unknown as Document;
    vi.stubGlobal("document", documentMock);

    injectCustomTheme(`:root {
      --canvas: #111;
      --surface: #222;
      --surface-subtle: #333;
      --surface-subtle-foreground: #eee;
      --sidebar-background: var(--surface);
      --surface-custom: #444;
      color: var(--surface);
    }`);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].textContent).toContain("--background: #111");
    expect(inserted[0].textContent).toContain("--card: #222");
    expect(inserted[0].textContent).toContain("--secondary: #333");
    expect(inserted[0].textContent).toContain("--secondary-foreground: #eee");
    expect(inserted[0].textContent).toContain("--sidebar: var(--card)");
    expect(inserted[0].textContent).toContain("--surface-custom: #444");
    expect(inserted[0].textContent).toContain("color: var(--card)");
  });
});
