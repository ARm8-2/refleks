import type { Settings } from "@/shared/types";
import { resolveWelcomeContent, type WelcomeContent } from "./content";

export type WelcomePresentation = {
  content: WelcomeContent;
  currentVersion: string;
  showMouseTraceChoice: boolean;
  showScreenCaptureChoice: boolean;
  showAnonymousChoice: boolean;
  initialAnonymousEnabled: boolean;
  initialMouseTrackingEnabled: boolean;
  initialScreenCaptureEnabled: boolean;
  runSyncEnabled: boolean;
};

function getLastSeenVersion(settings: Settings): string {
  return settings.lastSeenVersion?.trim() ?? "";
}

function buildPresentation(
  settings: Settings,
  currentVersion: string,
  previousVersion: string,
): WelcomePresentation {
  const isFirstLaunch = previousVersion === "";

  return {
    content: resolveWelcomeContent(currentVersion, previousVersion),
    currentVersion,
    showMouseTraceChoice: isFirstLaunch,
    showScreenCaptureChoice: true, // show on first launch AND version upgrades
    showAnonymousChoice: isFirstLaunch,
    initialAnonymousEnabled: settings.anonymousEnabled === true,
    initialMouseTrackingEnabled: settings.mouseTrackingEnabled === true,
    initialScreenCaptureEnabled: settings.screenCaptureEnabled === true,
    runSyncEnabled: settings.runSyncEnabled !== false,
  };
}

export function buildVersionWelcomePresentation(
  settings: Settings,
  version: string,
): WelcomePresentation | null {
  const currentVersion = version.trim();
  if (currentVersion === "") {
    return null;
  }

  const previousVersion = getLastSeenVersion(settings);
  const shouldShow = previousVersion !== currentVersion;
  if (!shouldShow) {
    return null;
  }

  return buildPresentation(settings, currentVersion, previousVersion);
}

export function buildManualWelcomePresentation(
  settings: Settings,
  version: string,
): WelcomePresentation | null {
  const currentVersion = version.trim();
  if (currentVersion === "") {
    return null;
  }

  const previousVersion = getLastSeenVersion(settings) || currentVersion;
  return buildPresentation(settings, currentVersion, previousVersion);
}

export function buildWelcomeSeenSettingsUpdate(
  settings: Settings,
  version: string,
): Settings {
  const currentVersion = version.trim();
  if (currentVersion === "") {
    return settings;
  }

  return {
    ...settings,
    lastSeenVersion: currentVersion,
  };
}

export function buildWelcomeSettingsUpdate(
  settings: Settings,
  updates: {
    anonymousEnabled: boolean;
    mouseTrackingEnabled?: boolean | null;
    screenCaptureEnabled?: boolean | null;
  },
): Settings {
  return {
    ...settings,
    anonymousEnabled: updates.anonymousEnabled,
    mouseTrackingEnabled:
      updates.mouseTrackingEnabled ?? settings.mouseTrackingEnabled,
    screenCaptureEnabled:
      updates.screenCaptureEnabled ?? settings.screenCaptureEnabled,
  };
}
