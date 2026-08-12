import { plural } from "../../plural";
import { WidenDeep } from "../types";

/**
 * Settings feature strings (SettingsPage, ResetSettingsModal, ClearCacheModal).
 * Option labels that pair with a stable machine value are keyed per option.
 */
export const settings = {
  page: {
    title: "Settings",
    description:
      "General behavior, privacy, appearance, and advanced integration options.",
    loading: "Loading settings...",
  },
  updates: {
    title: "Updates",
    description:
      "Check for the latest version, reopen the welcome screen, and review the current release.",
    currentVersion: "Current version:",
    checkForUpdates: "Check for Updates",
    readWelcomeAgain: "Read Welcome Again",
    failedToCheck: "Failed to check for updates",
    upToDate: "You're on the latest version!",
    versionAvailable: "Version {version} available",
    installBannerPrefix: "You're on {version}. Click",
    installBannerSuffix:
      "to download in the background — the app will close and the installer will launch automatically.",
    downloading: "Downloading...",
    installUpdate: "Install Update",
    viewChangelog: "View Changelog",
    failedToDownload: "Failed to download update",
  },
  general: {
    title: "General",
    description: "Core folders and session behavior.",
    kovaaksInstallFolder: "KovaaK's Install Folder",
    kovaaksInstallFolderDescription:
      "Path to the KovaaK's install folder used to locate FPSAimTrainer/stats and FPSAimTrainer/performances",
    startWithKovaaks: "Start with KovaaK's",
    startWithKovaaksDescription:
      "Automatically launch RefleK's when you start KovaaK's, RefleK's will also start with Windows",
    mouseTracking: "Mouse Tracking",
    mouseTrackingDescription: "Record mouse movement during scenarios (Windows only)",
    bufferDuration: "Buffer Duration",
    bufferDurationDescription: "Minutes of mouse data to keep in memory",
    screenCapture: "Screen Capture",
    screenCaptureDescription:
      "Record screen during scenarios for video replays (Windows only, requires FFmpeg)",
    screenCaptureStatusActive: "Screen capture active",
    screenCaptureStatusError: "Screen capture error",
    screenCaptureStatusUnavailable: "Screen capture unavailable",
    screenCaptureStatusReady: "Screen capture ready",
    screenCaptureEncoder: "Using {encoder}",
    screenCaptureHardware: " (hardware accelerated)",
    screenCaptureSoftware: " (software)",
    ffmpegMissingTitle: "FFmpeg not detected",
    ffmpegMissingPrefix: "Place",
    ffmpegMissingSuffix: "alongside",
    resolution: "Resolution",
    resolutionDescription:
      "Resolution used for new capture sessions; changing it while the game is running rotates the capture session immediately",
    resolutionNative: "Native (monitor res)",
    resolution1080: "1080p (1920×1080)",
    resolution900: "900p (1600×900)",
    resolution720: "720p (1280×720)",
    captureFps: "Capture FPS",
    captureFpsDescription:
      "Frames per second for new capture sessions; changing it while the game is running rotates the capture session immediately",
    replayCleanup: "Replay Cleanup",
    replayCleanupDescription:
      "Automatically remove old replays and limit replay storage; runs at startup and after new replays are created",
    replayAgeLimit: "Replay age limit",
    replayAgeLimitDescription:
      "Delete replays older than this; Unlimited disables the age limit",
    replayAge1d: "1 day",
    replayAge2d: "2 days",
    replayAge4d: "4 days",
    replayAge1w: "1 week",
    replayAge2w: "2 weeks",
    replayAge1m: "1 month",
    storageLimit: "Storage limit",
    storageLimitDescription:
      "Delete the oldest replays when the replay folder exceeds this size; Unlimited disables the storage limit",
    storage1gb: "1 GB",
    storage2gb: "2 GB",
    storage5gb: "5 GB",
    storage10gb: "10 GB",
    storage25gb: "25 GB",
    sessionGap: "Session Gap",
    sessionGapDescription: "Minutes of inactivity before starting a new session",
    sessionGapMinutes: plural({ one: "1 minute", other: "{count} minutes" }),
  },
  privacy: {
    title: "Privacy",
    description:
      "Control whether runs are uploaded and whether identifying environment data is scrubbed before sync.",
    runSync: "Run Sync",
    runSyncDescription: "Upload completed runs to the RefleK's Index.",
    anonymousMode: "Anonymous Mode",
    anonymousModeDescription:
      "Remove Steam ID and Steam persona name from run environment data before sync uploads.",
  },
  appearance: {
    title: "Appearance",
    description: "Visual preferences for the interface.",
    theme: "Theme",
    themeDescription: "Color theme for the application",
    themeDark: "Dark",
    themeDarker: "Darker",
    themeLight: "Light",
    font: "Font",
    fontDescription: "Font family for the interface",
    scale: "Scale",
    scaleDescription: "Interface size; smaller values fit more content on large screens",
    language: "Language",
    languageDescription: "Interface language for the application",
  },
  advanced: {
    title: "Advanced",
    description: "Integration and data retention options.",
    show: "Show advanced settings",
    hide: "Hide advanced settings",
    steam: "Steam",
    steamInstallDirectory: "Steam Install Directory",
    steamIdOverride: "Steam ID Override",
    personaNameOverride: "Persona Name Override",
    leaveEmpty: "Leave empty to auto-detect",
    displayNamePlaceholder: "Display name",
    dataRetention: "Data Retention",
    recentRunsWindow: "Recent Runs Window (Days)",
    recentRunsWindowDescription:
      "Only runs from the last N days are loaded and shown",
    recentRunsMinCount: "Recent Runs Minimum Count",
    recentRunsMinCountDescription:
      "If the day window has too few runs, include older runs until this minimum is reached",
  },
  footer: {
    clearCache: "Clear Cache",
    saving: "Saving settings...",
    unsavedChanges: "Unsaved changes",
    allSaved: "All changes saved",
    quitApp: "Quit App",
  },
  errors: {
    failedToSaveSettings: "Failed to save settings",
    failedToUpdateAutostart: "Failed to update autostart: {message}",
  },
  clearCache: {
    title: "Clear Cache",
    description:
      "This will clear all cached data including parsed stats and computed rankings. Your settings and session data will not be affected.",
    clearing: "Clearing...",
  },
  resetSettings: {
    title: "Reset Settings",
    description: "Select which data you want to reset to defaults:",
    settingsAndConfig: "Settings & Configuration",
    favoriteScenarios: "Favorite Scenarios",
    scenarioNotes: "Scenario Notes",
    sessionNotes: "Session Notes",
    resetting: "Resetting...",
    resetSelected: "Reset Selected",
  },
} as const;

export type SettingsMessages = WidenDeep<typeof settings>;
