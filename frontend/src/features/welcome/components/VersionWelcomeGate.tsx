import { getSettings, getVersion, updateSettings, useI18n } from "@/shared/lib";
import type { Settings } from "@/shared/types";
import { useEffect, useRef, useState } from "react";
import {
  buildVersionWelcomePresentation,
  buildWelcomeSeenSettingsUpdate,
  buildWelcomeSettingsUpdate,
  type WelcomePresentation,
} from "../lib/presentation";
import { WelcomeModalSession } from "./WelcomeModalSession";

export function VersionWelcomeGate() {
  const { locale } = useI18n();
  const [presentation, setPresentation] = useState<WelcomePresentation | null>(
    null,
  );
  const latestRef = useRef<{ settings: Settings; version: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getSettings(), getVersion()])
      .then(([settings, version]) => {
        if (cancelled) return;
        latestRef.current = { settings, version };

        const nextPresentation = buildVersionWelcomePresentation(
          settings,
          version,
        );
        if (!nextPresentation) return;

        setPresentation(nextPresentation);
      })
      .catch((error) => {
        console.warn("Failed to resolve welcome modal state:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the open modal's content in sync when the locale changes (e.g. the
  // persisted language arrives from the backend after mount). Never re-open
  // the gate based on locale alone.
  useEffect(() => {
    if (!latestRef.current) return;
    const nextPresentation = buildVersionWelcomePresentation(
      latestRef.current.settings,
      latestRef.current.version,
    );
    if (nextPresentation) setPresentation(nextPresentation);
  }, [locale]);

  const handleConfirm = async ({
    anonymousEnabled,
    mouseTrackingEnabled,
    screenCaptureEnabled,
  }: {
    anonymousEnabled: boolean;
    mouseTrackingEnabled: boolean | null;
    screenCaptureEnabled: boolean | null;
  }) => {
    if (!presentation) {
      return;
    }

    try {
      const settings = await getSettings();
      const nextSettings = buildWelcomeSeenSettingsUpdate(
        buildWelcomeSettingsUpdate(settings, {
          anonymousEnabled,
          mouseTrackingEnabled,
          screenCaptureEnabled,
        }),
        presentation.currentVersion,
      );
      await updateSettings(nextSettings);
    } catch (error) {
      console.warn("Failed to save welcome choice:", error);
    }
  };

  if (!presentation) {
    return null;
  }

  return (
    <WelcomeModalSession
      presentation={presentation}
      onConfirm={handleConfirm}
      onDismissed={(reason) => {
        setPresentation(null);

        if (reason === "dismiss") {
          void getSettings()
            .then((settings) =>
              updateSettings(
                buildWelcomeSeenSettingsUpdate(
                  settings,
                  presentation.currentVersion,
                ),
              ),
            )
            .catch((error) => {
              console.warn("Failed to persist welcome dismissal:", error);
            });
        }
      }}
    />
  );
}
