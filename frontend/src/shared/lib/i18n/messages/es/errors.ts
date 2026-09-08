import type { ErrorMessages } from "../en/errors";

/**
 * Traducciones al español para los mensajes del backend.
 */
export const errors: ErrorMessages = {
  replay: {
    processing: "Procesando la repetición…",
    ready: "La repetición está lista.",
    noCaptureSession: "La captura de pantalla no estuvo disponible para esta partida.",
    noSessionCoverage: "Ninguna sesión de captura cubrió esta partida.",
    outsideSession: "Esta partida quedó fuera de la sesión de captura disponible.",
    captureStopped: "La captura se detuvo antes de completar el procesamiento de la repetición.",
    processingFailed: "No se pudo procesar la repetición.",
    segmentsMissing: "Los segmentos de captura no cubrieron el intervalo de la partida.",
    trimTimedOut: "Se agotó el tiempo de espera de los segmentos de captura.",
    storageUnavailable: "El almacenamiento de partidas no está inicializado.",
    missing: "No existe ninguna repetición para esta partida.",
    exportFailed: "No se pudo exportar la repetición.",
  },
  screenCapture: {
    starting: "La captura aún no ha producido ningún fotograma.",
    active: "Capturando y recibiendo fotogramas.",
    uninitialized: "El sistema de captura de pantalla no está inicializado.",
  },
  update: {
    checkFailed: "No se pudieron comprobar las actualizaciones.",
    downloadFailed: "No se pudo descargar la actualización.",
    unsupportedOS: "Las actualizaciones automáticas solo son compatibles actualmente con Windows.",
  },
  autostart: {
    updateFailed: "No se pudo actualizar el inicio automático.",
  },
  benchmark: {
    progressFetchFailed: "No se pudo cargar el progreso del benchmark.",
  },
  scenario: {
    scoresFetchFailed: "No se pudieron cargar las puntuaciones del escenario.",
  },
};
