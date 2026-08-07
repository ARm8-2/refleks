import type { UserMessage } from "@/shared/types";
import i18n from "i18next";
import type { TranslationKey } from "./i18next.generated";

export const USER_MESSAGE_KEYS = {
  "replay.captureStopped": "errors:replay.captureStopped",
  "replay.captureUnavailable": "errors:replay.captureUnavailable",
  "replay.failed": "errors:replay.failed",
  "replay.incompleteCoverage": "errors:replay.incompleteCoverage",
  "replay.notRecorded": "errors:replay.notRecorded",
  "replay.outsideSession": "errors:replay.outsideSession",
  "replay.processing": "errors:replay.processing",
  "replay.publishing": "errors:replay.publishing",
  "replay.ready": "errors:replay.ready",
  "replay.sessionUnavailable": "errors:replay.sessionUnavailable",
  "replay.timeout": "errors:replay.timeout",
  "replay.unavailable": "errors:replay.unavailable",
  "screenCapture.active": "errors:screenCapture.active",
  "screenCapture.disabled": "errors:screenCapture.disabled",
  "screenCapture.failed": "errors:screenCapture.failed",
  "screenCapture.idle": "errors:screenCapture.idle",
  "screenCapture.ready": "errors:screenCapture.ready",
  "screenCapture.starting": "errors:screenCapture.starting",
  "screenCapture.unavailable": "errors:screenCapture.unavailable",
  "screenCapture.unsupported": "errors:screenCapture.unsupported",
} as const satisfies Record<string, TranslationKey>;

export type UserMessageCode = keyof typeof USER_MESSAGE_KEYS;

export function translateUserMessage(message?: UserMessage | null): string {
  const code = message?.messageCode as UserMessageCode | undefined;
  const key = code ? USER_MESSAGE_KEYS[code] : undefined;
  if (!key) {
    console.error("Unknown user message code", message?.messageCode, message?.messageParams);
    return i18n.t("errors:generic.unexpected");
  }
  return String(i18n.t(key as never, message?.messageParams as never));
}
