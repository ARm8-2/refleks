import { WidenDeep } from "../types";

/**
 * Localized text for user-facing messages produced by the Go backend. Each
 * entry pairs with a stable message code in `internal/codes`; the frontend
 * resolves a code to these strings via `translateMessage`.
 */
export const errors = {
  replay: {
    processing: "Processing replay…",
    ready: "Replay is ready.",
    noCaptureSession: "Screen capture was not available for this run.",
    noSessionCoverage: "No capture session covered this run.",
    outsideSession: "This run was outside the available capture session.",
    captureStopped: "Capture stopped before replay processing completed.",
    processingFailed: "Replay processing failed.",
    segmentsMissing: "Capture segments did not cover the run window.",
    trimTimedOut: "Timed out waiting for capture segments.",
    storageUnavailable: "Run storage is not initialized.",
    missing: "No replay exists for this run.",
    exportFailed: "Failed to export replay.",
  },
  screenCapture: {
    starting: "Capture has not produced a frame yet.",
    active: "Capturing and receiving frames.",
    uninitialized: "Screen capture runtime is not initialized.",
  },
  update: {
    checkFailed: "Failed to check for updates.",
    downloadFailed: "Failed to download update.",
    unsupportedOS: "Auto-updates are currently only supported on Windows.",
  },
  autostart: {
    updateFailed: "Failed to update autostart.",
  },
  benchmark: {
    progressFetchFailed: "Failed to load benchmark progress.",
  },
  scenario: {
    scoresFetchFailed: "Failed to load scenario scores.",
  },
} as const;

export type ErrorMessages = WidenDeep<typeof errors>;
