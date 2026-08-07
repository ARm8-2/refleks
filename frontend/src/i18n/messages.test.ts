import { beforeAll, describe, expect, it, vi } from "vitest";
import { changeAppLanguage, initializeI18n } from ".";
import {
  replayFailedFixture,
  replayProcessingFixture,
  replayUnavailableFixture,
  unknownMessageFixture,
} from "@/test/fixtures/acceptanceDtos";
import { translateUserMessage } from "./messages";

beforeAll(async () => {
  await initializeI18n("en");
});

describe("translateUserMessage", () => {
  it("translates a known code in the active language", async () => {
    expect(translateUserMessage(replayProcessingFixture)).toBe(
      "Processing replay...",
    );
    await changeAppLanguage("zh-CN");
    expect(translateUserMessage(replayProcessingFixture)).toBe(
      "正在处理回放……",
    );
    await changeAppLanguage("en");
  });

  it("logs and falls back for an unknown code", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(translateUserMessage(unknownMessageFixture)).toBe(
      "An unexpected error occurred.",
    );
    expect(error).toHaveBeenCalled();
  });

  it("covers deterministic replay status DTO states", () => {
    expect(translateUserMessage(replayProcessingFixture)).toBe(
      "Processing replay...",
    );
    expect(translateUserMessage(replayFailedFixture)).toBe(
      "Replay processing failed.",
    );
    expect(translateUserMessage(replayUnavailableFixture)).toBe(
      "Replay storage is not available.",
    );
  });
});
