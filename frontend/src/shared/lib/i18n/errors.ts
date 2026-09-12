import { translate, type MessageKey } from "./core";

/**
 * Stable message codes produced by the Go backend (`internal/constants`,
 * codes.go) for user-facing messages. Each code maps to a localized catalog
 * key. When a new code is added in Go, add its translation here (and to both
 * catalogs).
 */
const ERROR_MESSAGE_KEYS: Readonly<Record<string, MessageKey>> = {
  "replay:processing": "errors.replay.processing",
  "replay:ready": "errors.replay.ready",
  "replay:noCaptureSession": "errors.replay.noCaptureSession",
  "replay:noSessionCoverage": "errors.replay.noSessionCoverage",
  "replay:outsideSession": "errors.replay.outsideSession",
  "replay:captureStopped": "errors.replay.captureStopped",
  "replay:processingFailed": "errors.replay.processingFailed",
  "replay:segmentsMissing": "errors.replay.segmentsMissing",
  "replay:trimTimedOut": "errors.replay.trimTimedOut",
  "replay:storageUnavailable": "errors.replay.storageUnavailable",
  "replay:missing": "errors.replay.missing",
  "replay:exportFailed": "errors.replay.exportFailed",
  "screenCapture:starting": "errors.screenCapture.starting",
  "screenCapture:active": "errors.screenCapture.active",
  "screenCapture:uninitialized": "errors.screenCapture.uninitialized",
  "update:checkFailed": "errors.update.checkFailed",
  "update:downloadFailed": "errors.update.downloadFailed",
  "update:unsupportedOS": "errors.update.unsupportedOS",
  "autostart:updateFailed": "errors.autostart.updateFailed",
  "benchmark:progressFetchFailed": "errors.benchmark.progressFetchFailed",
  "scenario:scoresFetchFailed": "errors.scenario.scoresFetchFailed",
};

// Longest codes are matched first so a code can never be shadowed by a
// shorter prefix of itself.
const ERROR_CODES = Object.keys(ERROR_MESSAGE_KEYS).sort(
  (left, right) => right.length - left.length,
);

function matchMessageCode(text: string): string | null {
  for (const code of ERROR_CODES) {
    if (text === code || text.startsWith(code + ": ")) return code;
  }
  return null;
}

/**
 * Translate a backend-provided message (an `Error.message` from a Wails
 * call, a status struct `message` field, etc.) into the active locale.
 *
 * Backend messages that carry a known code (`<code>` or `<code>: <detail>`)
 * resolve through the catalog; everything else — including raw technical
 * detail — passes through as-is so no information is ever hidden.
 */
export function translateMessage(message: unknown): string {
  const text =
    message instanceof Error
      ? message.message
      : typeof message === "string"
        ? message
        : message == null
          ? ""
          : String(message);
  if (!text) return text;

  const code = matchMessageCode(text);
  if (code) return translate(ERROR_MESSAGE_KEYS[code]);
  return text;
}
