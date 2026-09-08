import type { ErrorMessages } from "../en/errors";

export const errors: ErrorMessages = {
  replay: {
    processing: "Обработка повтора…",
    ready: "Повтор готов.",
    noCaptureSession: "Для этого забега захват экрана был недоступен.",
    noSessionCoverage: "Сессия захвата не охватывает этот забег.",
    outsideSession: "Этот забег выполнен вне доступной сессии захвата.",
    captureStopped: "Захват остановился до завершения обработки повтора.",
    processingFailed: "Не удалось обработать повтор.",
    segmentsMissing: "Сегменты захвата не охватывают время забега.",
    trimTimedOut: "Истекло время ожидания сегментов захвата.",
    storageUnavailable: "Хранилище забегов не инициализировано.",
    missing: "Для этого забега нет повтора.",
    exportFailed: "Не удалось экспортировать повтор.",
  },
  screenCapture: {
    starting: "Захват ещё не получил ни одного кадра.",
    active: "Захват выполняется, кадры поступают.",
    uninitialized: "Среда захвата экрана не инициализирована.",
  },
  update: {
    checkFailed: "Не удалось проверить наличие обновлений.",
    downloadFailed: "Не удалось скачать обновление.",
    unsupportedOS: "Автообновления пока поддерживаются только в Windows.",
  },
  autostart: {
    updateFailed: "Не удалось обновить автозапуск.",
  },
  benchmark: {
    progressFetchFailed: "Не удалось загрузить прогресс бенчмарка.",
  },
  scenario: {
    scoresFetchFailed:
      "Не удалось загрузить результаты сценария. Проверьте настройки и убедитесь, что указано имя профиля.",
  },
};
