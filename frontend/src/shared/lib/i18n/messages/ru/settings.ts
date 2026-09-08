import { plural } from "../../plural";
import type { SettingsMessages } from "../en/settings";

export const settings: SettingsMessages = {
  page: {
    title: "Настройки",
    description:
      "Основные параметры поведения, конфиденциальности, внешнего вида и расширенной интеграции.",
    loading: "Загрузка настроек...",
  },
  updates: {
    title: "Обновления",
    description:
      "Проверяйте последнюю версию, снова открывайте экран приветствия и просматривайте текущий релиз.",
    currentVersion: "Текущая версия:",
    checkForUpdates: "Проверить обновления",
    readWelcomeAgain: "Снова открыть приветствие",
    failedToCheck: "Не удалось проверить обновления",
    upToDate: "У вас установлена последняя версия!",
    versionAvailable: "Доступна версия {version}",
    installBannerPrefix: "У вас версия {version}. Нажмите",
    installBannerSuffix:
      ", чтобы скачать обновление в фоне — приложение закроется, а установщик запустится автоматически.",
    downloading: "Скачивание...",
    installUpdate: "Установить обновление",
    viewChangelog: "Открыть список изменений",
    failedToDownload: "Не удалось скачать обновление",
  },
  general: {
    title: "Основные",
    description: "Основные папки и поведение сессий.",
    kovaaksInstallFolder: "Папка установки KovaaK's",
    kovaaksInstallFolderDescription:
      "Путь к папке установки KovaaK's, где находятся FPSAimTrainer/stats и FPSAimTrainer/performances",
    startWithKovaaks: "Запускать вместе с KovaaK's",
    startWithKovaaksDescription:
      "Автоматически запускать RefleK's при запуске KovaaK's; RefleK's также будет запускаться вместе с Windows",
    mouseTracking: "Отслеживание мыши",
    mouseTrackingDescription:
      "Записывать движения мыши во время сценариев (только Windows)",
    bufferDuration: "Размер буфера",
    bufferDurationDescription: "Сколько минут данных мыши хранить в памяти",
    screenCapture: "Захват экрана",
    screenCaptureDescription:
      "Записывать экран во время сценариев для видеоповторов (только Windows, требуется FFmpeg)",
    screenCaptureStatusActive: "Захват экрана активен",
    screenCaptureStatusError: "Ошибка захвата экрана",
    screenCaptureStatusUnavailable: "Захват экрана недоступен",
    screenCaptureStatusReady: "Захват экрана готов",
    screenCaptureEncoder: "Используется {encoder}",
    screenCaptureHardware: " (аппаратное ускорение)",
    screenCaptureSoftware: " (программный режим)",
    ffmpegMissingTitle: "FFmpeg не найден",
    ffmpegMissingPrefix: "Поместите",
    ffmpegMissingSuffix: "рядом с",
    resolution: "Разрешение",
    resolutionDescription:
      "Разрешение для новых сессий захвата; изменение во время работы игры немедленно переключает сессию захвата",
    resolutionNative: "Исходное (разрешение монитора)",
    resolution1080: "1080p (1920×1080)",
    resolution900: "900p (1600×900)",
    resolution720: "720p (1280×720)",
    captureFps: "FPS захвата",
    captureFpsDescription:
      "Кадров в секунду для новых сессий захвата; изменение во время работы игры немедленно переключает сессию захвата",
    replayCleanup: "Очистка повторов",
    replayCleanupDescription:
      "Автоматически удалять старые повторы и ограничивать их хранилище; выполняется при запуске и после создания новых повторов",
    replayAgeLimit: "Срок хранения повтора",
    replayAgeLimitDescription:
      "Удалять повторы старше указанного срока; вариант «Без ограничений» отключает ограничение по сроку",
    replayAge1d: "1 день",
    replayAge2d: "2 дня",
    replayAge4d: "4 дня",
    replayAge1w: "1 неделя",
    replayAge2w: "2 недели",
    replayAge1m: "1 месяц",
    storageLimit: "Лимит хранилища",
    storageLimitDescription:
      "Удалять самые старые повторы, когда папка повторов превышает этот размер; вариант «Без ограничений» отключает лимит хранилища",
    storage1gb: "1 ГБ",
    storage2gb: "2 ГБ",
    storage5gb: "5 ГБ",
    storage10gb: "10 ГБ",
    storage25gb: "25 ГБ",
    sessionGap: "Перерыв между сессиями",
    sessionGapDescription:
      "Сколько минут бездействия нужно для начала новой сессии",
    sessionGapMinutes: plural({ one: "1 минута", other: "{count} минут" }),
  },
  privacy: {
    title: "Конфиденциальность",
    description:
      "Управляйте загрузкой забегов и удалением идентифицирующих данных окружения перед синхронизацией.",
    runSync: "Синхронизация забегов",
    runSyncDescription: "Загружать завершённые забеги в RefleK's Index.",
    anonymousMode: "Анонимный режим",
    anonymousModeDescription:
      "Удалять Steam ID и имя профиля Steam из данных окружения забега перед загрузкой при синхронизации.",
  },
  appearance: {
    title: "Внешний вид",
    description: "Визуальные настройки интерфейса.",
    theme: "Тема",
    themeDescription: "Цветовая тема приложения",
    themeDark: "Тёмная",
    themeDarker: "Ещё темнее",
    themeLight: "Светлая",
    themeCustom: "Своя",
    themeCustomDescription:
      "Полностью настройте цвета, шрифты и другие параметры, изменив файл пользовательской темы в папке конфигурации RefleK's. Изменения применяются после перезапуска.",
    openThemeFile: "Открыть файл темы",
    regenerateThemeFile: "Создать заново",
    themeFileRegenerateConfirm:
      "Создать файл темы заново? Ваши настройки будут заменены значениями по умолчанию.",
    themeFileWriteFailed: "Не удалось записать файл пользовательской темы.",
    themeFileOpenFailed: "Не удалось открыть файл пользовательской темы.",
    font: "Шрифт",
    fontDescription: "Семейство шрифтов интерфейса",
    scale: "Масштаб",
    scaleDescription:
      "Размер интерфейса; меньшие значения позволяют разместить больше содержимого на больших экранах",
    language: "Язык",
    languageDescription: "Язык интерфейса приложения",
  },
  advanced: {
    title: "Расширенные",
    description: "Параметры интеграции и хранения данных.",
    show: "Показать расширенные настройки",
    hide: "Скрыть расширенные настройки",
    steam: "Steam",
    steamInstallDirectory: "Папка установки Steam",
    steamId: "Steam ID",
    steamIdDescription:
      "Определяется автоматически из активной учётной записи Steam.",
    personaName: "Имя профиля",
    personaNameDescription:
      "Введите имя пользователя из вашей учётной записи на kovaaks.com.",
    displayNamePlaceholder: "Отображаемое имя",
    dataRetention: "Хранение данных",
    recentRunsWindow: "Период последних забегов (дни)",
    recentRunsWindowDescription:
      "Загружаются и показываются только забеги за последние N дней",
    recentRunsMinCount: "Минимальное число последних забегов",
    recentRunsMinCountDescription:
      "Если за выбранный период слишком мало забегов, загружать более старые, пока не будет достигнут этот минимум",
  },
  footer: {
    clearCache: "Очистить кэш",
    saving: "Сохранение настроек...",
    unsavedChanges: "Есть несохранённые изменения",
    allSaved: "Все изменения сохранены",
    quitApp: "Выйти из приложения",
  },
  errors: {
    failedToSaveSettings: "Не удалось сохранить настройки",
    failedToUpdateAutostart: "Не удалось обновить автозапуск: {message}",
  },
  clearCache: {
    title: "Очистить кэш",
    description:
      "Будут удалены все кэшированные данные, включая обработанную статистику и рассчитанные рейтинги. Настройки и данные сессий не затрагиваются.",
    clearing: "Очистка...",
  },
  resetSettings: {
    title: "Сбросить настройки",
    description:
      "Выберите данные, которые нужно вернуть к значениям по умолчанию:",
    settingsAndConfig: "Настройки и конфигурация",
    favoriteScenarios: "Избранные сценарии",
    scenarioNotes: "Заметки сценариев",
    sessionNotes: "Заметки сессий",
    resetting: "Сброс...",
    resetSelected: "Сбросить выбранное",
  },
};
