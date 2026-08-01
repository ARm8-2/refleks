import { getSettings, getVersion, updateSettings } from "@/shared/lib";
import { useEffect, useState } from "react";
import {
  buildVersionWelcomePresentation,
  buildWelcomeSeenSettingsUpdate,
  buildWelcomeSettingsUpdate,
  type WelcomePresentation,
} from "../lib/presentation";
import { WelcomeModalSession } from "./WelcomeModalSession";

export function VersionWelcomeGate() {
  const [presentation, setPresentation] = useState<WelcomePresentation | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getSettings(), getVersion()])
      .then(([settings, version]) => {
        if (cancelled) return;

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
