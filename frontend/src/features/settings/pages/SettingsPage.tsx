import {
  WelcomeModalSession,
  buildManualWelcomePresentation,
  buildWelcomeSeenSettingsUpdate,
  buildWelcomeSettingsUpdate,
  type WelcomePresentation,
} from "@/features/welcome";
import {
  changeAppLanguage,
  currentAppLanguage,
  isAppLanguage,
  translateUserMessage,
  type AppLanguage,
} from "@/i18n";
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
  EXTERNAL_LINKS,
  FONTS,
  MISSING_VALUE,
  STORAGE_KEYS,
  THEMES,
  checkForUpdates,
  downloadAndInstallUpdate,
  getScreenCaptureInfo,
  getSettings,
  getVersion,
  openURL,
  quitApp,
  resetSettings,
  setAutostart,
  setFont,
  setTheme,
  updateSettings,
  type Font,
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
import { Trans, useTranslation } from "react-i18next";
import { ClearCacheModal } from "../components/ClearCacheModal";
import {
  ResetSettingsModal,
  type ResetOptions,
} from "../components/ResetSettingsModal";
import { SettingsField } from "../components/SettingsField";
import { SettingsSection } from "../components/SettingsSection";
import { preserveLanguageAfterReset } from "../lib/resetSettingsState";
import { SettingsSaveQueue } from "../lib/settingsSaveQueue";

const themeOptions = THEMES.map((t) => ({
  label: t
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  value: t,
}));
const fontOptions = FONTS.map((f) => ({ label: f.label, value: f.id }));
const sessionGapOptions = [5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => ({
  label: `${m} minutes`,
  value: String(m),
}));

export function SettingsPage() {
  const { t } = useTranslation(["settings", "common", "errors"]);
  const setSessionGap = useStore((s) => s.setSessionGap);
  const setSessionNotes = useStore((s) => s.setSessionNotes);
  const availableUpdate = useAvailableUpdate();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [showAdvanced, setShowAdvanced] = usePersistedState(
    STORAGE_KEYS.settingsShowAdvanced,
    false,
  );
  const saveQueueRef = useRef<SettingsSaveQueue | null>(null);
  const activeSavesRef = useRef(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLanguageSaving, setIsLanguageSaving] = useState(false);

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
      .then((current) => {
        saveQueueRef.current = new SettingsSaveQueue(current, updateSettings);
        setSettings(current);
      })
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
    const queue = saveQueueRef.current;
    if (!queue) return Promise.reject(new Error("Settings are not loaded"));
    queue.setLatest(next);
    activeSavesRef.current += 1;
    setIsSaving(true);
    return queue
      .enqueue()
      .then(({ saved, isCurrent }) => {
        setSessionGap(saved.sessionGapMinutes);
        setSessionNotes(saved.sessionNotes ?? {});
        if (isCurrent) setHasUnsavedChanges(false);
      })
      .catch((error: unknown) => {
        console.error("Save error:", error);
        alert(t("errors:settings.saveFailed"));
        throw error;
      })
      .finally(() => {
        activeSavesRef.current -= 1;
        setIsSaving(activeSavesRef.current > 0);
      });
  };

  const updateField = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
    persist = false,
  ) => {
    const current = saveQueueRef.current?.getLatest() ?? settings;
    if (!current) return;
    const next = { ...current, [key]: value };
    setSettings(next);
    saveQueueRef.current?.setLatest(next);
    if (persist) void queueSettingsSave(next).catch(() => {});
    else setHasUnsavedChanges(true);
  };

  const handleAutostartChange = async (enabled: boolean) => {
    try {
      await setAutostart(enabled);
      updateField("autostartEnabled", enabled);
    } catch (e) {
      console.error("setAutostart error:", e);
      alert(t("errors:settings.autostartFailed"));
    }
  };

  const handleThemeChange = (value: string) => {
    const theme = value as Theme;
    setTheme(theme);
    updateField("theme", theme, true);
  };

  const handleFontChange = (value: string) => {
    const font = value as Font;
    setFont(font);
    updateField("font", font, true);
  };

  const handleLanguageChange = async (value: string) => {
    if (!isAppLanguage(value) || !settings || !saveQueueRef.current) return;
    const language = value as AppLanguage;
    const queue = saveQueueRef.current;
    const next = { ...queue.getLatest(), language };
    queue.setLatest(next);
    setSettings(next);
    setIsLanguageSaving(true);
    activeSavesRef.current += 1;
    setIsSaving(true);
    try {
      const { saved, isCurrent } = await queue.saveLanguage(
        language,
        changeAppLanguage,
      );
      setSessionGap(saved.sessionGapMinutes);
      setSessionNotes(saved.sessionNotes ?? {});
      if (isCurrent) setHasUnsavedChanges(false);
      setSettings(queue.getLatest());
    } catch (error) {
      console.error("Language save error:", error);
      setSettings(queue.getLatest());
      alert(t("settings:language.saveFailed"));
    } finally {
      activeSavesRef.current -= 1;
      setIsSaving(activeSavesRef.current > 0);
      setIsLanguageSaving(false);
    }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    setCheckError("");
    try {
      const info = await checkForUpdates();
      setUpdate(info);
      setAvailableUpdate(info);
    } catch (e) {
      console.error("Update check failed:", e);
      setCheckError(t("errors:settings.updateCheckFailed"));
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
      console.error("Update download failed:", e);
      setDownloadError(t("errors:settings.updateDownloadFailed"));
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
    updateField("anonymousEnabled", enabled, true);
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

  const handleReset = async (options: ResetOptions) => {
    const queue = saveQueueRef.current;
    if (!queue) return;
    try {
      await queue.drain();
      await resetSettings(
        options.config,
        options.favorites,
        options.scenarioNotes,
        options.sessionNotes,
      );
      const current = await getSettings();
      const next = preserveLanguageAfterReset(
        current,
        queue.getCommitted(),
        currentAppLanguage(),
      );
      if (current.language !== next.language) await updateSettings(next);
      await changeAppLanguage(next.language!);
      queue.replaceCommitted(next);
      setSettings(next);
      setHasUnsavedChanges(false);
      setTheme(next.theme);
      if (next.font) setFont(next.font);
      setSessionGap(next.sessionGapMinutes);
      setSessionNotes(next.sessionNotes ?? {});
    } catch (e) {
      console.error("Reset error:", e);
      setSettings(queue.getCommitted());
      alert(t("errors:settings.resetFailed"));
    }
  };

  if (!settings) {
    return (
      <div className="flex h-full flex-col overflow-hidden text-sm">
        <div className="p-5 text-surface-muted-foreground">
          {t("settings:page.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-sm">
      <div className="sticky top-0 z-10 bg-canvas/95 px-5 py-4 backdrop-blur">
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold text-foreground">{t("settings:page.title")}</h1>
          <p className="text-xs text-surface-muted-foreground">
            {t("settings:page.description")}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          <SettingsSection
            title={t("settings:updates.title")}
            description={t("settings:updates.description")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-surface-muted-foreground">
                {t("settings:updates.currentVersion")}{" "}
                <span className="font-mono text-foreground">
                  {currentVersion || MISSING_VALUE}
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
                  t("settings:updates.check")
                )}
              </Button>
              <Button
                onClick={handleOpenWelcome}
                disabled={!currentVersion.trim()}
                variant="outline"
                size="sm"
              >
                {t("settings:updates.welcomeAgain")}
              </Button>
              {checkError && (
                <span className="text-sm text-destructive">{checkError}</span>
              )}
              {update && !update.hasUpdate && (
                <span className="text-sm text-surface-muted-foreground">
                  {t("settings:updates.latest")}
                </span>
              )}
            </div>
            {update?.hasUpdate && (
              <div className="space-y-3 rounded-xl bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("settings:updates.available", { version: update.latestVersion })}
                  </span>
                </div>
                <p className="text-xs text-surface-muted-foreground">
                  <Trans
                    ns="settings"
                    i18nKey="updates.installDescription"
                    values={{
                      currentVersion:
                        update.currentVersion || currentVersion || MISSING_VALUE,
                    }}
                    components={{ strong: <strong /> }}
                  />
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
                        {t("settings:updates.downloading")}
                      </>
                    ) : (
                      <>
                        <Download className="mr-1.5 h-4 w-4" />
                        {t("settings:updates.install")}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => openURL(EXTERNAL_LINKS.changelog)}
                    variant="outline"
                    size="sm"
                  >
                    {t("settings:updates.changelog")}
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
                title={t("settings:sections.general")}
                description={t("settings:sections.generalDescription")}
              >
                <SettingsField
                  label={t("settings:fields.installFolder")}
                  description={t("settings:fields.installFolderDescription")}
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
                  label={t("settings:fields.startWithGame")}
                  description={t("settings:fields.startWithGameDescription")}
                  checkbox
                >
                  <Checkbox
                    checked={!!settings.autostartEnabled}
                    onCheckedChange={(v) => handleAutostartChange(v === true)}
                  />
                </SettingsField>

                <SettingsField
                  label={t("settings:fields.mouseTracking")}
                  description={t("settings:fields.mouseTrackingDescription")}
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
                      label={t("settings:fields.bufferDuration")}
                      description={t("settings:fields.bufferDurationDescription")}
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
                      {t("settings:fields.screenCapture")}
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
                            <div className="max-w-xs space-y-1 text-[11px]">
                              <p className="font-medium text-popover-foreground">
                                {screenCaptureInfo.healthy
                                  ? t("settings:screenCapture.active")
                                  : screenCaptureInfo.state === "error"
                                    ? t("settings:screenCapture.error")
                                    : screenCaptureInfo.state === "unavailable"
                                      ? t("settings:screenCapture.unavailable")
                                      : t("settings:screenCapture.ready")}
                              </p>
                              <p className="text-popover-foreground/70">
                                {translateUserMessage(screenCaptureInfo)}
                              </p>
                              {screenCaptureInfo.encoderName && (
                                <p className="text-popover-foreground/70">
                                  {t("settings:screenCapture.usingEncoder", {
                                    encoder: screenCaptureInfo.encoderName,
                                  })}
                                  {screenCaptureInfo.isHardware
                                    ? t("settings:screenCapture.hardware")
                                    : t("settings:screenCapture.software")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="max-w-xs space-y-1 text-[11px]">
                              <p className="font-medium text-popover-foreground">
                                {t("settings:screenCapture.ffmpegMissing")}
                              </p>
                              <p className="text-popover-foreground/70">
                                {t("settings:screenCapture.ffmpegHint")}
                              </p>
                            </div>
                          )}
                        </InfoTooltip>
                      )}
                    </span>
                  }
                  description={t("settings:fields.screenCaptureDescription")}
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
                      label={t("settings:fields.resolution")}
                      description={t("settings:fields.resolutionDescription")}
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
                            {t("settings:options.nativeResolution")}
                          </SelectItem>
                          <SelectItem value="1080">
                            {t("settings:options.resolution1080")}
                          </SelectItem>
                        <SelectItem value="900">{t("settings:options.resolution900")}</SelectItem>
                        <SelectItem value="720">{t("settings:options.resolution720")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>

                    <SettingsField
                      label={t("settings:fields.captureFps")}
                      description={t("settings:fields.captureFpsDescription")}
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
                  label={t("settings:fields.sessionGap")}
                  description={t("settings:fields.sessionGapDescription")}
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
                          {t("settings:options.minutes", { value: option.value })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>
              </SettingsSection>

              <SettingsSection
                title={t("settings:sections.privacy")}
                description={t("settings:sections.privacyDescription")}
              >
                <SettingsField
                  label={t("settings:fields.runSync")}
                  description={t("settings:fields.runSyncDescription")}
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
                  label={t("settings:fields.anonymousMode")}
                  description={t("settings:fields.anonymousModeDescription")}
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
                title={t("settings:sections.appearance")}
                description={t("settings:sections.appearanceDescription")}
              >
                <SettingsField
                  label={t("settings:language.label")}
                  description={t("settings:language.description")}
                >
                  <Select
                    value={settings.language ?? currentAppLanguage()}
                    onValueChange={handleLanguageChange}
                    disabled={isLanguageSaving}
                  >
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("common:language.en")}</SelectItem>
                      <SelectItem value="zh-CN">
                        {t("common:language.zh-CN")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsField>

                <SettingsField
                  label={t("settings:fields.theme")}
                  description={t("settings:fields.themeDescription")}
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
                </SettingsField>

                <SettingsField
                  label={t("settings:fields.font")}
                  description={t("settings:fields.fontDescription")}
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
              </SettingsSection>

              <SettingsSection
                title={t("settings:sections.advanced")}
                description={t("settings:sections.advancedDescription")}
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
                    ? t("settings:advancedToggle.hide")
                    : t("settings:advancedToggle.show")}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">
                        {t("settings:sections.steam")}
                      </div>
                      <div className="space-y-4">
                        <SettingsField label={t("settings:fields.steamInstallDirectory")}>
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
                          label={t("settings:fields.steamIdOverride")}
                          description={t("settings:fields.autoDetect")}
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
                          label={t("settings:fields.personaNameOverride")}
                          description={t("settings:fields.autoDetect")}
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
                            placeholder={t("settings:fields.displayName")}
                            className="w-full max-w-xs"
                          />
                        </SettingsField>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">
                        {t("settings:sections.dataRetention")}
                      </div>
                      <div className="space-y-4">
                        <SettingsField
                          label={t("settings:fields.recentRunsWindow")}
                          description={t("settings:fields.recentRunsWindowDescription")}
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
                          label={t("settings:fields.recentRunsMinimum")}
                          description={t("settings:fields.recentRunsMinimumDescription")}
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
              {t("settings:actions.reset")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearCacheOpen(true)}
            >
              {t("settings:actions.clearCache")}
            </Button>
            <span className="text-xs text-surface-muted-foreground">
              {isSaving
                ? t("settings:state.saving")
                : hasUnsavedChanges
                  ? t("settings:state.unsaved")
                  : t("settings:state.saved")}
            </span>
            <div className="flex-1" />
            <Button
              variant="default"
              size="sm"
              onClick={() => handleEnterCommit()}
              disabled={isSaving || !settings}
            >
              {isSaving ? t("settings:actions.saving") : t("settings:actions.save")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => quitApp()}>
              {t("settings:actions.quit")}
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
