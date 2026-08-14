import {
  WelcomeModalSession,
  buildManualWelcomePresentation,
  buildWelcomeSeenSettingsUpdate,
  buildWelcomeSettingsUpdate,
  type WelcomePresentation,
} from "@/features/welcome";
import {
  Button,
  Checkbox,
  InfoTooltip,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components";
import {
  setAvailableUpdate,
  useAvailableUpdate,
  usePersistedState,
  useStore,
} from "@/shared/hooks";
import {
  DEFAULT_SCALE,
  EXTERNAL_LINKS,
  FONTS,
  SCALES,
  STORAGE_KEYS,
  THEMES,
  buildCustomThemeTemplate,
  checkForUpdates,
  downloadAndInstallUpdate,
  ensureCustomThemeFile,
  getCustomThemeCSS,
  getScreenCaptureInfo,
  getSettings,
  getVersion,
  injectCustomTheme,
  openCustomThemeCSS,
  openURL,
  quitApp,
  removeCustomTheme,
  setAutostart,
  setFont,
  setScale,
  setTheme,
  translateMessage,
  updateSettings,
  useI18n,
  writeCustomThemeCSS,
  type Font,
  type Locale,
  type MessageKey,
  type Scale,
  type Theme,
} from "@/shared/lib";
import type { ScreenCaptureInfo, Settings, UpdateInfo } from "@/shared/types";
import { ChevronDown, ChevronUp, Download, RefreshCw } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ClearCacheModal } from "../components/ClearCacheModal";
import { ResetSettingsModal } from "../components/ResetSettingsModal";
import { SettingsField } from "../components/SettingsField";
import { SettingsSection } from "../components/SettingsSection";

const THEME_LABEL_KEYS: Record<Theme, MessageKey> = {
  dark: "settings.appearance.themeDark",
  darker: "settings.appearance.themeDarker",
  light: "settings.appearance.themeLight",
  custom: "settings.appearance.themeCustom",
};

const fontOptions = FONTS.map((f) => ({ label: f.label, value: f.id }));
const scaleOptions = SCALES.map((s) => ({ label: s.label, value: s.id }));
const sessionGapMinutes = [5, 10, 15, 20, 30, 45, 60, 90, 120];
// Language names are shown in their own language by convention.
const languageOptions = [
  { label: "English", value: "en" },
  { label: "Nederlands", value: "nl" },
];
const replayRetentionOptionValues: { value: string; key: MessageKey }[] = [
  { value: "0", key: "common.actions.unlimited" },
  { value: "1", key: "settings.general.replayAge1d" },
  { value: "2", key: "settings.general.replayAge2d" },
  { value: "4", key: "settings.general.replayAge4d" },
  { value: "7", key: "settings.general.replayAge1w" },
  { value: "14", key: "settings.general.replayAge2w" },
  { value: "30", key: "settings.general.replayAge1m" },
];

const replayStorageOptionValues: { value: string; key: MessageKey }[] = [
  { value: "0", key: "common.actions.unlimited" },
  { value: "1", key: "settings.general.storage1gb" },
  { value: "2", key: "settings.general.storage2gb" },
  { value: "5", key: "settings.general.storage5gb" },
  { value: "10", key: "settings.general.storage10gb" },
  { value: "25", key: "settings.general.storage25gb" },
];

export function SettingsPage() {
  const setSessionGap = useStore((s) => s.setSessionGap);
  const setSessionNotes = useStore((s) => s.setSessionNotes);
  const availableUpdate = useAvailableUpdate();
  const { locale, setLocale, t } = useI18n();

  const themeOptions = THEMES.map((theme) => ({
    label: t(THEME_LABEL_KEYS[theme]),
    value: theme,
  }));
  const sessionGapOptions = sessionGapMinutes.map((m) => ({
    label: t("settings.general.sessionGapMinutes", { count: m }),
    value: String(m),
  }));
  const replayRetentionOptions = replayRetentionOptionValues.map((option) => ({
    label: t(option.key),
    value: option.value,
  }));
  const replayStorageOptions = replayStorageOptionValues.map((option) => ({
    label: t(option.key),
    value: option.value,
  }));

  const [settings, setSettings] = useState<Settings | null>(null);
  const [showAdvanced, setShowAdvanced] = usePersistedState(
    STORAGE_KEYS.settingsShowAdvanced,
    false,
  );
  const saveQueueRef = useRef(Promise.resolve());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [checkError, setCheckError] = useState<string>("");
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string>("");
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false);
  const [welcomePresentation, setWelcomePresentation] =
    useState<WelcomePresentation | null>(null);
  const [screenCaptureInfo, setScreenCaptureInfo] =
    useState<ScreenCaptureInfo | null>(null);
  const [screenCaptureLoading, setScreenCaptureLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {});
    getVersion()
      .then((v) => setCurrentVersion(v))
      .catch(() => setCurrentVersion(""));
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      getScreenCaptureInfo()
        .then((info) => {
          if (active) setScreenCaptureInfo(info);
        })
        .catch(() => {
          if (active) setScreenCaptureInfo(null);
        })
        .finally(() => {
          if (active) setScreenCaptureLoading(false);
        });

    void refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!availableUpdate) return;
    setUpdate((previous) => previous ?? availableUpdate);
  }, [availableUpdate]);

  const queueSettingsSave = (next: Settings) => {
    setIsSaving(true);
    const run = saveQueueRef.current
      .then(async () => {
        await updateSettings(next);
        setSessionGap(next.sessionGapMinutes);
        setSessionNotes(next.sessionNotes ?? {});
        setHasUnsavedChanges(false);
      })
      .catch((error: unknown) => {
        console.error("Save error:", error);
        alert(t("settings.errors.failedToSaveSettings"));
        throw error;
      })
      .finally(() => {
        setIsSaving(false);
      });

    saveQueueRef.current = run.catch(() => {});
    return run;
  };

  const updateField = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
    persist = false,
  ) => {
    setSettings((prev) => {
      if (!prev) return null;
      const next = { ...prev, [key]: value };
      if (persist) {
        void queueSettingsSave(next);
      } else {
        setHasUnsavedChanges(true);
      }
      return next;
    });
  };

  const handleAutostartChange = async (enabled: boolean) => {
    try {
      await setAutostart(enabled);
      updateField("autostartEnabled", enabled);
    } catch (e) {
      console.error("setAutostart error:", e);
      alert(
        translateMessage(e) || t("settings.errors.failedToUpdateAutostart"),
      );
    }
  };

  const handleThemeChange = async (value: string) => {
    const theme = value as Theme;
    try {
      if (theme === "custom") {
        // Generate the stylesheet on first use, then apply it on top of the
        // active base theme (the class on <html> stays untouched).
        await ensureCustomThemeFile();
      } else {
        removeCustomTheme();
      }
    } catch (e) {
      console.error("Custom theme apply error:", e);
      alert(t("settings.appearance.themeFileWriteFailed"));
      return;
    }
    setTheme(theme);
    updateField("theme", theme, true);
  };

  const handleOpenThemeFile = async () => {
    try {
      // Recreate the file if it was deleted manually, then open it with the
      // system's default handler (e.g. a text editor).
      if (!(await getCustomThemeCSS())) {
        await writeCustomThemeCSS(buildCustomThemeTemplate());
      }
      await openCustomThemeCSS();
    } catch (e) {
      console.error("Open custom theme file error:", e);
      alert(t("settings.appearance.themeFileOpenFailed"));
    }
  };

  const handleRegenerateThemeFile = async () => {
    if (!window.confirm(t("settings.appearance.themeFileRegenerateConfirm"))) {
      return;
    }
    try {
      const template = buildCustomThemeTemplate();
      await writeCustomThemeCSS(template);
      injectCustomTheme(template);
    } catch (e) {
      console.error("Regenerate custom theme error:", e);
      alert(t("settings.appearance.themeFileWriteFailed"));
    }
  };

  const handleFontChange = (value: string) => {
    const font = value as Font;
    setFont(font);
    updateField("font", font, true);
  };

  const handleScaleChange = (value: string) => {
    const scale = value as Scale;
    setScale(scale);
    updateField("scale", scale, true);
  };

  const handleLanguageChange = (value: string) => {
    const language = value as Locale;
    setLocale(language);
    updateField("language", language, true);
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    setCheckError("");
    try {
      const info = await checkForUpdates();
      setUpdate(info);
      setAvailableUpdate(info);
    } catch (e) {
      setCheckError(translateMessage(e) || t("settings.updates.failedToCheck"));
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadInstall = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadAndInstallUpdate(update?.latestVersion ?? "");
    } catch (e) {
      setDownloadError(
        translateMessage(e) || t("settings.updates.failedToDownload"),
      );
      setDownloading(false);
    }
    // On success the app quits — no need to reset state
  };

  const handleOpenWelcome = () => {
    if (!settings) return;

    const nextPresentation = buildManualWelcomePresentation(
      settings,
      currentVersion,
    );
    if (!nextPresentation) return;

    setWelcomePresentation(nextPresentation);
  };

  const handleWelcomeConfirm = async ({
    anonymousEnabled,
    mouseTrackingEnabled,
    screenCaptureEnabled,
  }: {
    anonymousEnabled: boolean;
    mouseTrackingEnabled: boolean | null;
    screenCaptureEnabled: boolean | null;
  }) => {
    if (!settings || !welcomePresentation) return;

    const next = buildWelcomeSeenSettingsUpdate(
      buildWelcomeSettingsUpdate(settings, {
        anonymousEnabled,
        mouseTrackingEnabled,
        screenCaptureEnabled,
      }),
      welcomePresentation.currentVersion,
    );
    setSettings(next);
    try {
      await queueSettingsSave(next);
    } catch {
      // queueSettingsSave already surfaced the failure to the user.
    }
  };

  const handleAnonymousChange = (enabled: boolean) => {
    setSettings((prev) => {
      if (!prev) return null;
      const next = {
        ...prev,
        anonymousEnabled: enabled,
      };
      void queueSettingsSave(next).catch(() => {});
      return next;
    });
  };

  const handleEnterCommit = (input?: HTMLInputElement) => {
    if (settings) {
      void queueSettingsSave(settings);
      input?.blur();
    }
  };

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleEnterCommit(e.currentTarget);
  };

  const handleReset = async () => {
    try {
      const current = await getSettings();
      setSettings(current);
      setHasUnsavedChanges(false);
      setTheme(current.theme);
      // A reset restores a built-in theme; drop any injected custom styles.
      if (current.theme !== "custom") {
        removeCustomTheme();
      }
      if (current.font) setFont(current.font);
      if (current.scale) setScale(current.scale);
      setLocale(current.language);
      setSessionGap(current.sessionGapMinutes);
      setSessionNotes(current.sessionNotes ?? {});
    } catch (e) {
      console.error("Reset error:", e);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-full flex-col overflow-hidden text-sm">
        <div className="p-5 text-surface-muted-foreground">
          {t("settings.page.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-sm">
      <div className="sticky top-0 z-10 bg-canvas/95 px-5 py-4 backdrop-blur">
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold text-foreground">
            {t("settings.page.title")}
          </h1>
          <p className="text-xs text-surface-muted-foreground">
            {t("settings.page.description")}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          <SettingsSection
            title={t("settings.updates.title")}
            description={t("settings.updates.description")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-surface-muted-foreground">
                {t("settings.updates.currentVersion")}{" "}
                <span className="font-mono text-foreground">
                  {currentVersion || t("common.missingValue")}
                </span>
              </span>
              <Button
                onClick={handleCheckUpdate}
                disabled={checking}
                variant="outline"
                size="sm"
              >
                {checking ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  t("settings.updates.checkForUpdates")
                )}
              </Button>
              <Button
                onClick={handleOpenWelcome}
                disabled={!currentVersion.trim()}
                variant="outline"
                size="sm"
              >
                {t("settings.updates.readWelcomeAgain")}
              </Button>
              {checkError && (
                <span className="text-sm text-destructive">{checkError}</span>
              )}
              {update && !update.hasUpdate && (
                <span className="text-sm text-surface-muted-foreground">
                  {t("settings.updates.upToDate")}
                </span>
              )}
            </div>
            {update?.hasUpdate && (
              <div className="space-y-3 rounded-xl bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("settings.updates.versionAvailable", {
                      version: update.latestVersion,
                    })}
                  </span>
                </div>
                <p className="text-xs text-surface-muted-foreground">
                  {t("settings.updates.installBannerPrefix", {
                    version:
                      update.currentVersion ||
                      currentVersion ||
                      t("common.missingValue"),
                  })}{" "}
                  <strong>{t("settings.updates.installUpdate")}</strong>{" "}
                  {t("settings.updates.installBannerSuffix")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleDownloadInstall}
                    disabled={downloading}
                    variant="default"
                    size="sm"
                  >
                    {downloading ? (
                      <>
                        <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                        {t("settings.updates.downloading")}
                      </>
                    ) : (
                      <>
                        <Download className="mr-1.5 h-4 w-4" />
                        {t("settings.updates.installUpdate")}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => openURL(EXTERNAL_LINKS.changelog)}
                    variant="outline"
                    size="sm"
                  >
                    {t("settings.updates.viewChangelog")}
                  </Button>
                  {downloadError && (
                    <span className="text-sm text-destructive">
                      {downloadError}
                    </span>
                  )}
                </div>
              </div>
            )}
          </SettingsSection>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <SettingsSection
                title={t("settings.general.title")}
                description={t("settings.general.description")}
              >
                <SettingsField
                  label={t("settings.general.kovaaksInstallFolder")}
                  description={t(
                    "settings.general.kovaaksInstallFolderDescription",
                  )}
                >
                  <Input
                    type="text"
                    value={settings.kovaaksInstallDir}
                    onChange={(e) =>
                      updateField("kovaaksInstallDir", e.target.value)
                    }
                    onKeyDown={handleInputKeyDown}
                    className="w-full max-w-xl"
                  />
                </SettingsField>

                <SettingsField
                  label={t("settings.general.startWithKovaaks")}
                  description={t(
                    "settings.general.startWithKovaaksDescription",
                  )}
                  checkbox
                >
                  <Checkbox
                    checked={!!settings.autostartEnabled}
                    onCheckedChange={(v) => handleAutostartChange(v === true)}
                  />
                </SettingsField>

                <SettingsField
                  label={t("settings.general.mouseTracking")}
                  description={t("settings.general.mouseTrackingDescription")}
                  checkbox
                >
                  <Checkbox
                    checked={!!settings.mouseTrackingEnabled}
                    onCheckedChange={(v) =>
                      updateField("mouseTrackingEnabled", v === true, true)
                    }
                  />
                </SettingsField>

                {settings.mouseTrackingEnabled && (
                  <div className="space-y-3 pl-6">
                    <SettingsField
                      label={t("settings.general.bufferDuration")}
                      description={t(
                        "settings.general.bufferDurationDescription",
                      )}
                    >
                      <Input
                        type="number"
                        value={settings.mouseBufferMinutes}
                        onChange={(e) =>
                          updateField(
                            "mouseBufferMinutes",
                            parseInt(e.target.value, 10) || 5,
                          )
                        }
                        onKeyDown={handleInputKeyDown}
                        min={1}
                        max={60}
                        className="w-20 text-center"
                      />
                    </SettingsField>
                  </div>
                )}

                <SettingsField
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      {t("settings.general.screenCapture")}
                      {screenCaptureLoading ? null : (
                        <InfoTooltip
                          side="bottom"
                          icon={
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                screenCaptureInfo?.healthy
                                  ? "bg-emerald-500"
                                  : screenCaptureInfo?.state === "error" ||
                                      screenCaptureInfo?.state === "unavailable"
                                    ? "bg-red-500"
                                    : "bg-amber-500"
                              }`}
                            />
                          }
                          iconClassName="h-auto w-auto"
                        >
                          {screenCaptureInfo ? (
                            <div className="max-w-xs space-y-1 text-[0.6875rem]">
                              <p className="font-medium text-popover-foreground">
                                {screenCaptureInfo.healthy
                                  ? t(
                                      "settings.general.screenCaptureStatusActive",
                                    )
                                  : screenCaptureInfo.state === "error"
                                    ? t(
                                        "settings.general.screenCaptureStatusError",
                                      )
                                    : screenCaptureInfo.state === "unavailable"
                                      ? t(
                                          "settings.general.screenCaptureStatusUnavailable",
                                        )
                                      : t(
                                          "settings.general.screenCaptureStatusReady",
                                        )}
                              </p>
                              <p className="text-popover-foreground/70">
                                {translateMessage(screenCaptureInfo.message)}
                              </p>
                              {screenCaptureInfo.encoderName && (
                                <p className="text-popover-foreground/70">
                                  {t("settings.general.screenCaptureEncoder", {
                                    encoder: screenCaptureInfo.encoderName,
                                  })}
                                  {screenCaptureInfo.isHardware
                                    ? t(
                                        "settings.general.screenCaptureHardware",
                                      )
                                    : t(
                                        "settings.general.screenCaptureSoftware",
                                      )}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="max-w-xs space-y-1 text-[0.6875rem]">
                              <p className="font-medium text-popover-foreground">
                                {t("settings.general.ffmpegMissingTitle")}
                              </p>
                              <p className="text-popover-foreground/70">
                                {t("settings.general.ffmpegMissingPrefix")}{" "}
                                <code className="rounded bg-surface-muted px-1 py-0.5 font-mono">
                                  ffmpeg.exe
                                </code>{" "}
                                {t("settings.general.ffmpegMissingSuffix")}{" "}
                                <code className="rounded bg-surface-muted px-1 py-0.5 font-mono">
                                  refleks.exe
                                </code>
                                .
                              </p>
                            </div>
                          )}
                        </InfoTooltip>
                      )}
                    </span>
                  }
                  description={t("settings.general.screenCaptureDescription")}
                  checkbox
                >
                  <Checkbox
                    checked={!!settings.screenCaptureEnabled}
                    onCheckedChange={(v) =>
                      updateField("screenCaptureEnabled", v === true, true)
                    }
                  />
                </SettingsField>

                {settings.screenCaptureEnabled && (
                  <div className="space-y-3 pl-6">
                    <SettingsField
                      label={t("settings.general.resolution")}
                      description={t("settings.general.resolutionDescription")}
                    >
                      <Select
                        value={settings.screenCaptureResolution || "720"}
                        onValueChange={(v) =>
                          updateField("screenCaptureResolution", v, true)
                        }
                      >
                        <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="native">
                            {t("settings.general.resolutionNative")}
                          </SelectItem>
                          <SelectItem value="1080">
                            {t("settings.general.resolution1080")}
                          </SelectItem>
                          <SelectItem value="900">
                            {t("settings.general.resolution900")}
                          </SelectItem>
                          <SelectItem value="720">
                            {t("settings.general.resolution720")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>

                    <SettingsField
                      label={t("settings.general.captureFps")}
                      description={t("settings.general.captureFpsDescription")}
                    >
                      <Input
                        type="number"
                        value={settings.screenCaptureFps ?? 30}
                        onChange={(e) =>
                          updateField(
                            "screenCaptureFps",
                            parseInt(e.target.value, 10) || 30,
                          )
                        }
                        onKeyDown={handleInputKeyDown}
                        onBlur={() => void queueSettingsSave(settings)}
                        min={5}
                        max={60}
                        className="w-20 text-center"
                      />
                    </SettingsField>
                  </div>
                )}

                <SettingsField
                  label={t("settings.general.replayCleanup")}
                  description={t("settings.general.replayCleanupDescription")}
                  checkbox
                >
                  <Checkbox
                    checked={settings.replayCleanupEnabled !== false}
                    onCheckedChange={(v) =>
                      updateField("replayCleanupEnabled", v === true, true)
                    }
                  />
                </SettingsField>

                {settings.replayCleanupEnabled !== false && (
                  <div className="space-y-3 pl-6">
                    <SettingsField
                      label={t("settings.general.replayAgeLimit")}
                      description={t(
                        "settings.general.replayAgeLimitDescription",
                      )}
                    >
                      <Select
                        value={String(settings.replayRetentionDays ?? 0)}
                        onValueChange={(v) =>
                          updateField(
                            "replayRetentionDays",
                            parseInt(v, 10),
                            true,
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {replayRetentionOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>

                    <SettingsField
                      label={t("settings.general.storageLimit")}
                      description={t(
                        "settings.general.storageLimitDescription",
                      )}
                    >
                      <Select
                        value={String(settings.replayStorageLimitGb ?? 5)}
                        onValueChange={(v) =>
                          updateField(
                            "replayStorageLimitGb",
                            parseInt(v, 10),
                            true,
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {replayStorageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>
                  </div>
                )}

                <SettingsField
                  label={t("settings.general.sessionGap")}
                  description={t("settings.general.sessionGapDescription")}
                >
                  <Select
                    value={String(settings.sessionGapMinutes)}
                    onValueChange={(v) =>
                      updateField("sessionGapMinutes", parseInt(v, 10), true)
                    }
                  >
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionGapOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>
              </SettingsSection>

              <SettingsSection
                title={t("settings.privacy.title")}
                description={t("settings.privacy.description")}
              >
                <SettingsField
                  label={t("settings.privacy.runSync")}
                  description={t("settings.privacy.runSyncDescription")}
                  checkbox
                >
                  <Checkbox
                    checked={settings.runSyncEnabled !== false}
                    onCheckedChange={(v) =>
                      updateField("runSyncEnabled", v === true, true)
                    }
                  />
                </SettingsField>

                <SettingsField
                  label={t("settings.privacy.anonymousMode")}
                  description={t("settings.privacy.anonymousModeDescription")}
                  checkbox
                >
                  <Checkbox
                    checked={settings.anonymousEnabled === true}
                    onCheckedChange={(v) => handleAnonymousChange(v === true)}
                  />
                </SettingsField>
              </SettingsSection>
            </div>

            <div className="space-y-4">
              <SettingsSection
                title={t("settings.appearance.title")}
                description={t("settings.appearance.description")}
              >
                <SettingsField
                  label={t("settings.appearance.theme")}
                  description={t("settings.appearance.themeDescription")}
                >
                  <Select
                    value={settings.theme}
                    onValueChange={handleThemeChange}
                  >
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {settings.theme === "custom" && (
                    <div className="mt-2 space-y-2 rounded-xl bg-surface-subtle p-3">
                      <p className="text-xs leading-5 text-surface-muted-foreground">
                        {t("settings.appearance.themeCustomDescription")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleOpenThemeFile()}
                        >
                          {t("settings.appearance.openThemeFile")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRegenerateThemeFile()}
                        >
                          {t("settings.appearance.regenerateThemeFile")}
                        </Button>
                      </div>
                    </div>
                  )}
                </SettingsField>

                <SettingsField
                  label={t("settings.appearance.font")}
                  description={t("settings.appearance.fontDescription")}
                >
                  <Select
                    value={settings.font || FONTS[0].id}
                    onValueChange={handleFontChange}
                  >
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>

                <SettingsField
                  label={t("settings.appearance.scale")}
                  description={t("settings.appearance.scaleDescription")}
                >
                  <Select
                    value={settings.scale || DEFAULT_SCALE}
                    onValueChange={handleScaleChange}
                  >
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scaleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>

                <SettingsField
                  label={t("settings.appearance.language")}
                  description={t("settings.appearance.languageDescription")}
                >
                  <Select value={locale} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>
              </SettingsSection>

              <SettingsSection
                title={t("settings.advanced.title")}
                description={t("settings.advanced.description")}
              >
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-sm text-surface-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {showAdvanced
                    ? t("settings.advanced.hide")
                    : t("settings.advanced.show")}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">
                        {t("settings.advanced.steam")}
                      </div>
                      <div className="space-y-4">
                        <SettingsField
                          label={t("settings.advanced.steamInstallDirectory")}
                        >
                          <Input
                            type="text"
                            value={settings.steamInstallDir}
                            onChange={(e) =>
                              updateField("steamInstallDir", e.target.value)
                            }
                            onKeyDown={handleInputKeyDown}
                            className="w-full max-w-xl"
                          />
                        </SettingsField>

                        <SettingsField
                          label={t("settings.advanced.steamIdOverride")}
                          description={t("settings.advanced.leaveEmpty")}
                        >
                          <Input
                            type="text"
                            value={settings.steamIdOverride || ""}
                            onChange={(e) =>
                              updateField(
                                "steamIdOverride",
                                e.target.value || undefined,
                              )
                            }
                            onKeyDown={handleInputKeyDown}
                            placeholder="76561198000000000"
                            className="w-full max-w-xs font-mono"
                          />
                        </SettingsField>

                        <SettingsField
                          label={t("settings.advanced.personaNameOverride")}
                          description={t("settings.advanced.leaveEmpty")}
                        >
                          <Input
                            type="text"
                            value={settings.personaNameOverride || ""}
                            onChange={(e) =>
                              updateField(
                                "personaNameOverride",
                                e.target.value || undefined,
                              )
                            }
                            onKeyDown={handleInputKeyDown}
                            placeholder={t(
                              "settings.advanced.displayNamePlaceholder",
                            )}
                            className="w-full max-w-xs"
                          />
                        </SettingsField>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">
                        {t("settings.advanced.dataRetention")}
                      </div>
                      <div className="space-y-4">
                        <SettingsField
                          label={t("settings.advanced.recentRunsWindow")}
                          description={t(
                            "settings.advanced.recentRunsWindowDescription",
                          )}
                        >
                          <Input
                            type="number"
                            value={settings.recentRunsDays}
                            onChange={(e) => {
                              const next = parseInt(e.target.value, 10);
                              updateField(
                                "recentRunsDays",
                                Number.isFinite(next) && next > 0
                                  ? next
                                  : settings.recentRunsDays,
                              );
                            }}
                            onKeyDown={handleInputKeyDown}
                            min={1}
                            max={3650}
                            className="w-24 text-center"
                          />
                        </SettingsField>

                        <SettingsField
                          label={t("settings.advanced.recentRunsMinCount")}
                          description={t(
                            "settings.advanced.recentRunsMinCountDescription",
                          )}
                        >
                          <Input
                            type="number"
                            value={settings.recentRunsMinCount}
                            onChange={(e) => {
                              const next = parseInt(e.target.value, 10);
                              updateField(
                                "recentRunsMinCount",
                                Number.isFinite(next) && next > 0
                                  ? next
                                  : settings.recentRunsMinCount,
                              );
                            }}
                            onKeyDown={handleInputKeyDown}
                            min={1}
                            max={50000}
                            className="w-24 text-center"
                          />
                        </SettingsField>
                      </div>
                    </div>
                  </div>
                )}
              </SettingsSection>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetOpen(true)}
            >
              {t("common.actions.reset")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearCacheOpen(true)}
            >
              {t("settings.footer.clearCache")}
            </Button>
            <span className="text-xs text-surface-muted-foreground">
              {isSaving
                ? t("settings.footer.saving")
                : hasUnsavedChanges
                  ? t("settings.footer.unsavedChanges")
                  : t("settings.footer.allSaved")}
            </span>
            <div className="flex-1" />
            <Button
              variant="default"
              size="sm"
              onClick={() => handleEnterCommit()}
              disabled={isSaving || !settings}
            >
              {isSaving ? t("common.actions.saving") : t("common.actions.save")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => quitApp()}>
              {t("settings.footer.quitApp")}
            </Button>
          </div>
        </div>
      </div>

      <ResetSettingsModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onReset={handleReset}
      />
      <ClearCacheModal
        isOpen={isClearCacheOpen}
        onClose={() => setIsClearCacheOpen(false)}
      />
      {welcomePresentation && (
        <WelcomeModalSession
          presentation={welcomePresentation}
          onConfirm={handleWelcomeConfirm}
          onDismissed={() => setWelcomePresentation(null)}
        />
      )}
    </div>
  );
}
