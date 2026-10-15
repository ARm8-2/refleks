import type { Font, Scale, Theme } from "../../lib/theme";
import type { Locale } from "../../lib/i18n";
import type { MotionPreference } from "../../lib/motion";

export interface Settings {
  steamInstallDir?: string;
  kovaaksInstallDir: string;
  steamIdOverride?: string;
  personaNameOverride?: string;
  lastSeenVersion?: string;
  sessionGapMinutes: number;
  recentRunsDays: number;
  recentRunsMinCount: number;
  theme: Theme;
  font: Font;
  scale: Scale;
  language: Locale;
  motionPreference: MotionPreference;
  favoriteBenchmarks?: string[];
  mouseTrackingEnabled?: boolean;
  mouseBufferMinutes?: number;
  screenCaptureEnabled?: boolean;
  screenCaptureFps?: number;
  screenCaptureResolution?: string;
  replayCleanupEnabled?: boolean;
  replayRetentionDays?: number;
  replayStorageLimitGb?: number;
  autostartEnabled?: boolean;
  anonymousEnabled?: boolean;
  runSyncEnabled?: boolean;
  scenarioNotes?: Record<string, ScenarioNote>;
  sessionNotes?: Record<string, SessionNote>;
}

export interface ScenarioNote {
  notes: string;
  sens: string;
}

export interface SessionNote {
  name: string;
  notes: string;
}
