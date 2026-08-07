import type { Settings } from "@/shared/types";
import { describe, expect, it, vi } from "vitest";
import {
  pendingLanguageSettingsFixture,
  persistedSettingsFixture,
  persistenceFailureFixture,
} from "@/test/fixtures/acceptanceDtos";
import { SettingsSaveQueue } from "./settingsSaveQueue";

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    kovaaksInstallDir: "",
    sessionGapMinutes: 20,
    recentRunsDays: 90,
    recentRunsMinCount: 1000,
    theme: "dark",
    font: "montserrat",
    ...overrides,
  };
}

describe("SettingsSaveQueue", () => {
  it("reads the latest snapshot when an older request starts", async () => {
    const saved: Settings[] = [];
    const queue = new SettingsSaveQueue(settings({ language: "en" }), async (value) => {
      saved.push(value);
    });

    queue.setLatest(settings({ language: "en", sessionGapMinutes: 30 }));
    const first = queue.enqueue();
    queue.setLatest(settings({ language: "zh-CN", sessionGapMinutes: 45 }));
    const second = queue.enqueue();

    await Promise.all([first, second]);
    expect(saved.at(-1)).toMatchObject({ language: "zh-CN", sessionGapMinutes: 45 });
    expect(queue.getCommitted()).toMatchObject({
      language: "zh-CN",
      sessionGapMinutes: 45,
    });
  });

  it("keeps later edits after a language save", async () => {
    const queue = new SettingsSaveQueue(settings({ language: "en" }), vi.fn(async () => {}));
    queue.setLatest(settings({ language: "zh-CN" }));
    const languageSave = queue.enqueue();
    queue.setLatest(settings({ language: "zh-CN", sessionGapMinutes: 60 }));
    const laterSave = queue.enqueue();

    await Promise.all([languageSave, laterSave]);
    expect(queue.getCommitted()).toMatchObject({
      language: "zh-CN",
      sessionGapMinutes: 60,
    });
  });

  it("rolls back to the last committed snapshot after failure", async () => {
    const queue = new SettingsSaveQueue(
      persistedSettingsFixture,
      vi.fn(async () => {
        throw persistenceFailureFixture;
      }),
    );
    queue.setLatest(pendingLanguageSettingsFixture);

    await expect(queue.enqueue()).rejects.toThrow(
      persistenceFailureFixture.message,
    );
    expect(queue.rollback()).toEqual(persistedSettingsFixture);
  });

  it("applies language only after the matching snapshot is persisted", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const apply = vi.fn(async () => {});
    const queue = new SettingsSaveQueue(settings({ language: "en" }), async () => blocked);

    const saving = queue.saveLanguage("zh-CN", apply);
    await Promise.resolve();
    expect(apply).not.toHaveBeenCalled();
    release();
    await saving;
    expect(apply).toHaveBeenCalledWith("zh-CN");
  });

  it("does not apply a failed language and restores the committed language", async () => {
    const apply = vi.fn(async () => {});
    const queue = new SettingsSaveQueue(settings({ language: "en" }), async () => {
      throw new Error("disk full");
    });

    await expect(queue.saveLanguage("zh-CN", apply)).rejects.toThrow("disk full");
    expect(apply).not.toHaveBeenCalled();
    expect(queue.getLatest().language).toBe("en");
  });

  it("drains all queued saves before reset", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = new SettingsSaveQueue(settings(), async () => blocked);
    queue.setLatest(settings({ sessionGapMinutes: 30 }));
    void queue.enqueue();
    const drained = vi.fn();
    const draining = queue.drain().then(drained);

    await Promise.resolve();
    expect(drained).not.toHaveBeenCalled();
    release();
    await draining;
    expect(drained).toHaveBeenCalledOnce();
  });
});
