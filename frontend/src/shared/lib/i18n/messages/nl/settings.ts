import { plural } from "../../plural";
import type { SettingsMessages } from "../en/settings";

/**
 * Nederlandse vertalingen voor de instellingen.
 */
export const settings: SettingsMessages = {
  page: {
    title: "Instellingen",
    description:
      "Algemeen gedrag, privacy, uiterlijk en geavanceerde integratieopties.",
    loading: "Instellingen laden...",
  },
  updates: {
    title: "Updates",
    description:
      "Controleer op de nieuwste versie, open het welkomstscherm opnieuw en bekijk de huidige release.",
    currentVersion: "Huidige versie:",
    checkForUpdates: "Controleren op updates",
    readWelcomeAgain: "Welkomstscherm opnieuw lezen",
    failedToCheck: "Controleren op updates mislukt",
    upToDate: "Je gebruikt de nieuwste versie!",
    versionAvailable: "Versie {version} beschikbaar",
    installBannerPrefix: "Je gebruikt {version}. Klik op",
    installBannerSuffix:
      "om te downloaden op de achtergrond — de app wordt gesloten en de installatie start automatisch.",
    downloading: "Downloaden...",
    installUpdate: "Update installeren",
    viewChangelog: "Changelog bekijken",
    failedToDownload: "Downloaden van update mislukt",
  },
  general: {
    title: "Algemeen",
    description: "Kernmappen en sessiegedrag.",
    kovaaksInstallFolder: "KovaaK's installatiemap",
    kovaaksInstallFolderDescription:
      "Pad naar de KovaaK's installatiemap, gebruikt om FPSAimTrainer/stats en FPSAimTrainer/performances te vinden",
    startWithKovaaks: "Starten met KovaaK's",
    startWithKovaaksDescription:
      "Start RefleK's automatisch wanneer je KovaaK's start; RefleK's start dan ook met Windows",
    mouseTracking: "Muisregistratie",
    mouseTrackingDescription:
      "Neem muisbeweging op tijdens scenario's (alleen Windows)",
    bufferDuration: "Bufferduur",
    bufferDurationDescription: "Minuten muisdata om in het geheugen te bewaren",
    screenCapture: "Schermopname",
    screenCaptureDescription:
      "Neem het scherm op tijdens scenario's voor videoreplays (alleen Windows, vereist FFmpeg)",
    screenCaptureStatusActive: "Schermopname actief",
    screenCaptureStatusError: "Fout bij schermopname",
    screenCaptureStatusUnavailable: "Schermopname niet beschikbaar",
    screenCaptureStatusReady: "Schermopname gereed",
    screenCaptureEncoder: "Gebruikt {encoder}",
    screenCaptureHardware: " (hardwarematig versneld)",
    screenCaptureSoftware: " (software)",
    ffmpegMissingTitle: "FFmpeg niet gedetecteerd",
    ffmpegMissingPrefix: "Plaats",
    ffmpegMissingSuffix: "naast",
    resolution: "Resolutie",
    resolutionDescription:
      "Resolutie voor nieuwe opnamesessies; wijzigen terwijl het spel draait roteert de opnamesessie direct",
    resolutionNative: "Native (monitorresolutie)",
    resolution1080: "1080p (1920×1080)",
    resolution900: "900p (1600×900)",
    resolution720: "720p (1280×720)",
    captureFps: "Opname-FPS",
    captureFpsDescription:
      "Frames per seconde voor nieuwe opnamesessies; wijzigen terwijl het spel draait roteert de opnamesessie direct",
    replayCleanup: "Replay-opschoning",
    replayCleanupDescription:
      "Verwijder oude replays automatisch en beperk de replayopslag; draait bij het opstarten en nadat nieuwe replays zijn gemaakt",
    replayAgeLimit: "Leeftijdslimiet replays",
    replayAgeLimitDescription:
      "Verwijder replays ouder dan dit; Onbeperkt schakelt de leeftijdslimiet uit",
    replayAge1d: "1 dag",
    replayAge2d: "2 dagen",
    replayAge4d: "4 dagen",
    replayAge1w: "1 week",
    replayAge2w: "2 weken",
    replayAge1m: "1 maand",
    storageLimit: "Opslaglimiet",
    storageLimitDescription:
      "Verwijder de oudste replays wanneer de replaymap groter wordt dan dit; Onbeperkt schakelt de opslaglimiet uit",
    storage1gb: "1 GB",
    storage2gb: "2 GB",
    storage5gb: "5 GB",
    storage10gb: "10 GB",
    storage25gb: "25 GB",
    sessionGap: "Sessiepauze",
    sessionGapDescription:
      "Minuten inactiviteit voordat een nieuwe sessie start",
    sessionGapMinutes: plural({ one: "1 minuut", other: "{count} minuten" }),
  },
  privacy: {
    title: "Privacy",
    description:
      "Bepaal of runs worden geüpload en of herkenbare omgevingsgegevens vóór synchronisatie worden verwijderd.",
    runSync: "Run-synchronisatie",
    runSyncDescription: "Upload voltooide runs naar de RefleK's Index.",
    anonymousMode: "Anonieme modus",
    anonymousModeDescription:
      "Verwijder Steam-ID en Steam-personanaam uit runomgevingsgegevens vóór synchronisatie-uploads.",
  },
  appearance: {
    title: "Uiterlijk",
    description: "Visuele voorkeuren voor de interface.",
    theme: "Thema",
    themeDescription: "Kleurenthema voor de applicatie",
    themeDark: "Donker",
    themeDarker: "Donkerder",
    themeLight: "Licht",
    themeCustom: "Aangepast",
    themeCustomDescription:
      "Pas kleuren, lettertypen en meer volledig aan door het aangepaste themabestand in je RefleK's-configmap te bewerken. Wijzigingen gelden na een herstart.",
    openThemeFile: "Themabestand openen",
    regenerateThemeFile: "Opnieuw genereren",
    themeFileRegenerateConfirm:
      "Themabestand opnieuw genereren? Je aanpassingen worden vervangen door de standaardwaarden.",
    themeFileWriteFailed: "Aangepaste themabestand schrijven mislukt.",
    themeFileOpenFailed: "Aangepaste themabestand openen mislukt.",
    font: "Lettertype",
    fontDescription: "Lettertypefamilie voor de interface",
    scale: "Schaal",
    scaleDescription:
      "Interfacegrootte; kleinere waarden passen meer inhoud op grote schermen",
    language: "Taal",
    languageDescription: "Interfacetaal voor de applicatie",
  },
  advanced: {
    title: "Geavanceerd",
    description: "Integratie- en gegevensbewaaropties.",
    show: "Geavanceerde instellingen tonen",
    hide: "Geavanceerde instellingen verbergen",
    steam: "Steam",
    steamInstallDirectory: "Steam-installatiemap",
    steamIdOverride: "Steam-ID-overschrijving",
    personaNameOverride: "Personanaam-overschrijving",
    leaveEmpty: "Leeg laten om automatisch te detecteren",
    displayNamePlaceholder: "Weergavenaam",
    dataRetention: "Gegevensbewaring",
    recentRunsWindow: "Venster recente runs (dagen)",
    recentRunsWindowDescription:
      "Alleen runs van de afgelopen N dagen worden geladen en getoond",
    recentRunsMinCount: "Minimum aantal recente runs",
    recentRunsMinCountDescription:
      "Als het dagvenster te weinig runs bevat, neem oudere runs op tot dit minimum is bereikt",
  },
  footer: {
    clearCache: "Cache wissen",
    saving: "Instellingen opslaan...",
    unsavedChanges: "Niet-opgeslagen wijzigingen",
    allSaved: "Alle wijzigingen opgeslagen",
    quitApp: "App afsluiten",
  },
  errors: {
    failedToSaveSettings: "Instellingen opslaan mislukt",
    failedToUpdateAutostart: "Autostart bijwerken mislukt: {message}",
  },
  clearCache: {
    title: "Cache wissen",
    description:
      "Hiermee worden alle gecachte gegevens gewist, waaronder geparseerde statistieken en berekende rankings. Je instellingen en sessiegegevens blijven behouden.",
    clearing: "Bezig met wissen...",
  },
  resetSettings: {
    title: "Instellingen resetten",
    description:
      "Selecteer welke gegevens je naar de standaardwaarden wilt resetten:",
    settingsAndConfig: "Instellingen en configuratie",
    favoriteScenarios: "Favoriete scenario's",
    scenarioNotes: "Scenarionotities",
    sessionNotes: "Sessienotities",
    resetting: "Bezig met resetten...",
    resetSelected: "Selectie resetten",
  },
};
