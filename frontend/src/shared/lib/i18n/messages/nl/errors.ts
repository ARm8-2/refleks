import type { ErrorMessages } from "../en/errors";

/**
 * Nederlandse vertalingen voor backend-berichten (zie `internal/codes` voor
 * de bijbehorende code-identificatoren).
 */
export const errors: ErrorMessages = {
  replay: {
    processing: "Replay verwerken…",
    ready: "Replay is klaar.",
    noCaptureSession: "Schermopname was niet beschikbaar voor deze run.",
    noSessionCoverage: "Geen opnamesessie bedekte deze run.",
    outsideSession: "Deze run viel buiten de beschikbare opnamesessie.",
    captureStopped: "Opname stopte voordat de replayverwerking was voltooid.",
    processingFailed: "Replayverwerking mislukt.",
    segmentsMissing: "Opnamesegmenten bedekten het runvenster niet.",
    trimTimedOut: "Timeout bij het wachten op opnamesegmenten.",
    storageUnavailable: "Runopslag is niet geïnitialiseerd.",
    missing: "Geen replay voor deze run.",
    exportFailed: "Replay exporteren mislukt.",
  },
  screenCapture: {
    starting: "Opname heeft nog geen frame geproduceerd.",
    active: "Neemt op en ontvangt frames.",
    uninitialized: "Schermopname-runtime is niet geïnitialiseerd.",
  },
  update: {
    checkFailed: "Controleren op updates mislukt.",
    downloadFailed: "Update downloaden mislukt.",
    unsupportedOS:
      "Auto-updates worden momenteel alleen ondersteund op Windows.",
  },
  autostart: {
    updateFailed: "Autostart bijwerken mislukt.",
  },
  benchmark: {
    progressFetchFailed: "Benchmarkvoortgang laden mislukt.",
  },
  scenario: {
    scoresFetchFailed: "Scenarioscores laden mislukt.",
  },
};
