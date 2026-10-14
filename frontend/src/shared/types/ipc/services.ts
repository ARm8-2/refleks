export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl?: string;
  releaseNotes?: string;
}

export interface ScreenCaptureInfo {
  encoderName: string;
  container: string;
  isHardware: boolean;
  available: boolean;
  active: boolean;
  healthy: boolean;
  state: string;
  message: string;
  lastError?: string;
  lastFrameUnixMilli?: number;
}

export interface ReplayStatus {
  state: "processing" | "ready" | "unavailable" | "failed";
  message: string;
}

export interface ReplayFileInfo {
  width: number;
  height: number;
  fps: number;
  codec: string;
  durationSeconds: number;
  sizeBytes: number;
}

export interface KovaaksScoreAttributes {
  score: number;
  challengeStart: string;
}

export interface KovaaksLastScore {
  id: string;
  type: string;
  attributes: KovaaksScoreAttributes;
}
