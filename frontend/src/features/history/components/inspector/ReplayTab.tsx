import { Button, InfoTooltip, Modal } from "@/shared/components";
import { Slider } from "@/shared/components/ui/slider";
import { EventsOn } from "@wails/runtime";
import {
  deleteRunReplay,
  exportRunReplay,
  getRunReplay,
  getRunReplayInfo,
  getRunReplayStatus,
} from "@/shared/lib";
import { cn } from "@/shared/lib/utils";
import type { ReplayFileInfo, ReplayStatus } from "@/shared/types/ipc";
import {
  Download,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryRun } from "../../lib/historyModels";

type Props = {
  primaryRun: HistoryRun;
  compareRun: HistoryRun | null;
};

type ReplaySource = {
  filePath: string;
  path: string;
};

// Replays are trimmed out of a rolling capture buffer asynchronously after a
// run finishes (see internal/runs/ingest.go: scheduleScreenTrim), which can
// take up to ScreenCaptureTrimMaxWaitSeconds (45s) plus a few seconds of
// encode time. Slots resolve through exactly two mechanisms:
//
//  1. A debounced lookup on mount/selection resolves replays that already
//     reached a terminal state before this tab existed.
//  2. The store pushes replay:status the moment a trim finishes (or fails),
//     which resolves a waiting slot immediately. Transitions are never
//     polled; the event is the only live-update path.
//
// Debounce the actual replay lookup/load after the selected run changes.
// Clicking through several runs quickly would otherwise mount (fetch +
// decode) and immediately tear down a video for every run passed through
// along the way — each cycle briefly holds real decoder memory, and doing
// that for every intermediate click adds up to visible, avoidable churn.
// Waiting for the selection to settle means only the run the user actually
// stops on ever loads a video.
const REPLAY_SELECT_DEBOUNCE_MS = 200;

const fallbackReplayStatus = (): ReplayStatus => ({
  state: "processing",
  message: "Waiting for replay status…",
});

async function lookupReplay(filePath: string): Promise<{
  path: string | null;
  status: ReplayStatus;
}> {
  const [pathResult, statusResult] = await Promise.allSettled([
    getRunReplay(filePath),
    getRunReplayStatus(filePath),
  ]);
  let path = pathResult.status === "fulfilled" ? pathResult.value : null;
  let status =
    statusResult.status === "fulfilled"
      ? statusResult.value
      : fallbackReplayStatus();

  // The status and path are separate IPC calls. If publication happens
  // between them, recheck once instead of displaying a terminal "ready"
  // state with no playable URL.
  if (path === null && status.state === "ready") {
    try {
      path = await getRunReplay(filePath);
    } catch {
      path = null;
    }
    if (path === null) {
      status = {
        state: "processing",
        message: "Replay was published and is becoming available…",
      };
    }
  }

  return { path, status };
}

export function ReplayTab({ primaryRun, compareRun }: Props) {
  const [primaryReplay, setPrimaryReplay] = useState<ReplaySource | null>(null);
  const [compareReplay, setCompareReplay] = useState<ReplaySource | null>(null);
  const [primaryStatus, setPrimaryStatus] = useState<ReplayStatus | null>(null);
  const [compareStatus, setCompareStatus] = useState<ReplayStatus | null>(null);
  const [primaryWaiting, setPrimaryWaiting] = useState(true);
  const [compareWaiting, setCompareWaiting] = useState(false);

  useEffect(() => {
    let active = true;
    let primaryPath: string | null = null;
    let comparePath: string | null = null;
    let primaryResolved = false;
    let compareResolved = !compareRun;

    setPrimaryReplay(null);
    setCompareReplay(null);
    setPrimaryStatus(null);
    setCompareStatus(null);
    setPrimaryWaiting(true);
    setCompareWaiting(!!compareRun);

    // One-shot lookup: resolves slots whose replay already reached a terminal
    // state before this tab mounted. Live transitions are pushed by the
    // replay:status event below instead of being polled.
    const lookup = async () => {
      // Once a slot has resolved, keep its URL and only query the slot that
      // is still processing. This avoids repeated IPC/filesystem work and
      // React updates while the other replay catches up.
      const [primaryLookup, compareLookup] = await Promise.all([
        primaryResolved
          ? Promise.resolve({
              path: primaryPath,
              status: {
                state: "ready",
                message: "Replay is ready.",
              } satisfies ReplayStatus,
            })
          : lookupReplay(primaryRun.item.filePath),
        compareResolved || !compareRun
          ? Promise.resolve(null)
          : lookupReplay(compareRun.item.filePath),
      ]);
      if (!active) return;

      primaryPath = primaryLookup.path;
      primaryResolved = primaryPath !== null;
      setPrimaryStatus(primaryLookup.status);
      if (primaryPath !== null) {
        setPrimaryReplay({
          filePath: primaryRun.item.filePath,
          path: primaryPath,
        });
      }

      if (compareRun && compareLookup) {
        comparePath = compareLookup.path;
        compareResolved = comparePath !== null;
        setCompareStatus(compareLookup.status);
        if (comparePath !== null) {
          setCompareReplay({
            filePath: compareRun.item.filePath,
            path: comparePath,
          });
        }
      }

      // A slot stays in the waiting state only while its trim is genuinely
      // processing; the replay:status event flips it the moment the trim
      // reaches a terminal state.
      setPrimaryWaiting(
        !primaryResolved && primaryLookup.status.state === "processing",
      );
      setCompareWaiting(
        !!compareRun &&
          !!compareLookup &&
          !compareResolved &&
          compareLookup.status.state === "processing",
      );
    };

    const debounceTimer = setTimeout(lookup, REPLAY_SELECT_DEBOUNCE_MS);

    // The store pushes replay:status the moment a trim finishes (or fails),
    // resolving the matching slot immediately. Events that fired before this
    // tab mounted are covered by the debounced lookup above.
    const offReplayStatus = EventsOn(
      "replay:status",
      (payload: { path?: string }) => {
        if (!active || !payload?.path) return;
        const p = payload.path;
        const isPrimary = p === primaryRun.item.filePath && !primaryResolved;
        const isCompare =
          !!compareRun && p === compareRun.item.filePath && !compareResolved;
        if (!isPrimary && !isCompare) return;
        void lookup();
      },
    );

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      offReplayStatus();
    };
  }, [primaryRun.item.filePath, compareRun?.item.filePath]);

  return (
    <div className="space-y-3">
      {compareRun ? (
        <div className="grid gap-3">
          <ReplaySlot
            filePath={primaryRun.item.filePath}
            path={
              primaryReplay?.filePath === primaryRun.item.filePath
                ? primaryReplay.path
                : null
            }
            waiting={primaryWaiting}
            status={primaryStatus}
            label="Primary"
            onDeleted={() => setPrimaryReplay(null)}
          />
          <ReplaySlot
            filePath={compareRun.item.filePath}
            path={
              compareReplay?.filePath === compareRun.item.filePath
                ? compareReplay.path
                : null
            }
            waiting={compareWaiting}
            status={compareStatus}
            label="Compare"
            onDeleted={() => setCompareReplay(null)}
          />
        </div>
      ) : (
        <ReplaySlot
          filePath={primaryRun.item.filePath}
          path={
            primaryReplay?.filePath === primaryRun.item.filePath
              ? primaryReplay.path
              : null
          }
          waiting={primaryWaiting}
          status={primaryStatus}
          onDeleted={() => setPrimaryReplay(null)}
        />
      )}
    </div>
  );
}

/* ─── Replay slot: waiting / empty / player ─── */

function ReplaySlot({
  filePath,
  path,
  waiting,
  status,
  label,
  onDeleted,
}: {
  filePath: string;
  path: string | null;
  waiting: boolean;
  status: ReplayStatus | null;
  label?: string;
  onDeleted: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenTime, setFullscreenTime] = useState(0);

  useEffect(() => {
    setFullscreen(false);
    setFullscreenTime(0);
  }, [path]);

  if (path) {
    if (fullscreen) {
      return (
        <Modal
          isOpen
          onClose={() => setFullscreen(false)}
          title={label ? `Replay – ${label}` : "Replay"}
          className="flex flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1">
            <VideoPlayer
              key={`${path}-fullscreen`}
              path={path}
              filePath={filePath}
              label={label}
              onDeleted={onDeleted}
              initialTime={fullscreenTime}
              onPositionChange={setFullscreenTime}
              fitAvailable
            />
          </div>
        </Modal>
      );
    }

    return (
      <VideoPlayer
        key={path}
        path={path}
        filePath={filePath}
        label={label}
        onDeleted={onDeleted}
        onExpand={(time) => {
          setFullscreenTime(time);
          setFullscreen(true);
        }}
      />
    );
  }

  return (
    <div
      className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center"
      style={waiting ? { aspectRatio: DEFAULT_ASPECT } : undefined}
    >
      <p className="text-sm text-surface-muted-foreground" aria-live="polite">
        {waiting
          ? status?.message || "Waiting for replay to finish processing…"
          : status?.message || "No replay is available for this run."}
      </p>
    </div>
  );
}

/* ─── Video Player ─── */

const SPEED_MIN = 0.1;
const SPEED_MAX = 4;
const SPEED_DEFAULT = 1;
const DEFAULT_ASPECT = 16 / 9;

function releaseVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.srcObject = null;
  video.load();
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function VideoPlayer({
  path,
  filePath,
  label,
  onDeleted,
  initialTime = 0,
  onPositionChange,
  onExpand,
  fitAvailable = false,
}: {
  path: string;
  filePath: string;
  label?: string;
  onDeleted: () => void;
  initialTime?: number;
  onPositionChange?: (time: number) => void;
  onExpand?: (time: number) => void;
  fitAvailable?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(SPEED_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  // Tracks whether a seek the browser is currently processing is in flight,
  // and the latest still-unapplied seek target requested while it's busy.
  // Scrubbing quickly issues many `currentTime` writes in a row; without
  // this, each one queues its own decode-from-keyframe work and they stack
  // up, making playback appear laggy/stuttery well after the user stops
  // dragging. Instead, only one seek is ever in flight — newer requests
  // replace the pending one rather than piling up.
  const seekingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const initialSeekRef = useRef(initialTime);

  const [info, setInfo] = useState<ReplayFileInfo | null>(null);
  const [infoUnavailable, setInfoUnavailable] = useState(false);
  const infoRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (exportTimerRef.current) {
        clearTimeout(exportTimerRef.current);
        exportTimerRef.current = null;
      }
    };
  }, []);

  // Probing launches ffmpeg. Do it only when the browser cannot provide a
  // finite duration or the user actually opens the info control; starting a
  // subprocess for every replay selected in the history list is needless CPU
  // and memory churn.
  const loadInfo = useCallback(() => {
    if (info || infoRequestedRef.current) return;
    infoRequestedRef.current = true;
    setInfoUnavailable(false);
    getRunReplayInfo(filePath)
      .then((res) => {
        if (!mountedRef.current) return;
        setInfo(res);
        setInfoUnavailable(res === null);
        if (
          res &&
          Number.isFinite(res.durationSeconds) &&
          res.durationSeconds > 0
        ) {
          setDuration((d) =>
            Number.isFinite(d) && d > 0 ? d : res.durationSeconds,
          );
        }
      })
      .catch(() => {
        // Let an explicit later hover/focus retry a transient probe failure.
        infoRequestedRef.current = false;
        if (mountedRef.current) {
          setInfo(null);
          setInfoUnavailable(true);
        }
      });
  }, [filePath, info]);

  // Release the video element's decoder/buffer resources as soon as we're
  // done with it. Just letting React unmount the <video> node isn't enough —
  // Chromium can keep the underlying media pipeline (and any buffered/
  // decoded frames) alive well past that point unless the element is
  // explicitly torn down first. Without this, memory used by every replay
  // ever opened stacks up for the lifetime of the app.
  useEffect(() => {
    // Capture the mounted node now: React may detach refs before passive
    // effect cleanup, which otherwise skips release of decoder frame buffers.
    const video = videoRef.current;
    return () => {
      if (video) releaseVideo(video);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {
        // Playback can be rejected when the replay has just been deleted or
        // the media pipeline is being torn down for a new selection.
      });
    } else {
      v.pause();
    }
  }, []);

  const requestSeek = useCallback(
    (time: number, fast = false) => {
      const v = videoRef.current;
      if (!v) return;
      const max =
        duration > 0
          ? duration
          : Number.isFinite(v.duration)
            ? v.duration
            : time;
      const clamped = Math.max(0, Math.min(max, time));
      if (seekingRef.current) {
        pendingSeekRef.current = clamped;
        return;
      }
      if (Math.abs(v.currentTime - clamped) < 0.01) return;
      seekingRef.current = true;
      if (fast && typeof v.fastSeek === "function") {
        v.fastSeek(clamped);
      } else {
        v.currentTime = clamped;
      }
    },
    [duration],
  );

  const seek = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      requestSeek((pendingSeekRef.current ?? v.currentTime) + delta);
    },
    [requestSeek],
  );

  // Sync speed to video element
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed]);

  const handleDelete = async () => {
    const video = videoRef.current;
    setDeleting(true);
    setDeleteError(null);
    // Release WebView's file/decoder handle before deleting; Windows will
    // otherwise commonly reject the delete while Chromium still owns it.
    if (video) releaseVideo(video);
    try {
      await deleteRunReplay(filePath);
      setConfirmOpen(false);
      onDeleted();
    } catch {
      if (video) {
        video.src = path;
        video.playbackRate = speed;
        video.load();
      }
      setDeleteError(
        "Could not delete this replay. Close other apps using it and try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const speedLabel =
    speed === Math.round(speed) ? `${speed}x` : `${speed.toFixed(1)}x`;
  const isDefaultSpeed = Math.abs(speed - SPEED_DEFAULT) < 0.05;
  const closeDeleteModal = () => {
    if (!deleting) setConfirmOpen(false);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportFeedback(null);
    if (exportTimerRef.current) {
      clearTimeout(exportTimerRef.current);
      exportTimerRef.current = null;
    }
    try {
      const savedTo = await exportRunReplay(filePath);
      // An empty result means the user cancelled the save dialog.
      if (savedTo) {
        setExportFeedback({ text: `Saved to ${savedTo}` });
        exportTimerRef.current = setTimeout(() => {
          setExportFeedback(null);
          exportTimerRef.current = null;
        }, 6000);
      }
    } catch (err) {
      setExportFeedback({
        text:
          err instanceof Error
            ? `Export failed: ${err.message}`
            : "Export failed.",
        error: true,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className={cn(fitAvailable ? "flex h-full flex-col gap-2" : "space-y-2")}
    >
      <div className={cn(fitAvailable && "flex min-h-0 flex-1 justify-center")}>
        <div
          className={cn(
            "relative overflow-hidden rounded-xl bg-black",
            fitAvailable ? "h-fit max-h-full w-fit max-w-full" : "w-full",
          )}
        >
          {playbackError && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black/75 p-4 text-center text-sm text-white/80">
              {playbackError}
            </div>
          )}
          {label && (
            <span className="absolute left-2 top-2 z-20 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white/80">
              {label}
            </span>
          )}
          <video
            ref={videoRef}
            src={path}
            preload="metadata"
            playsInline
            className={cn(
              "block",
              fitAvailable ? "max-h-full max-w-full" : "h-auto w-full",
            )}
            style={{ aspectRatio: aspect }}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (v && !dragging) {
                setCurrentTime(v.currentTime);
                onPositionChange?.(v.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (!v) return;
              setPlaybackError(null);
              if (v.videoWidth && v.videoHeight) {
                setAspect(v.videoWidth / v.videoHeight);
              }
              if (Number.isFinite(v.duration)) {
                setDuration(v.duration);
              } else {
                loadInfo();
              }
              if (initialSeekRef.current > 0 && Number.isFinite(v.duration)) {
                seekingRef.current = true;
                v.currentTime = Math.min(initialSeekRef.current, v.duration);
                initialSeekRef.current = 0;
              }
            }}
            onDurationChange={() => {
              const v = videoRef.current;
              if (v && Number.isFinite(v.duration)) setDuration(v.duration);
            }}
            onSeeking={() => {
              seekingRef.current = true;
            }}
            onSeeked={() => {
              seekingRef.current = false;
              const next = pendingSeekRef.current;
              pendingSeekRef.current = null;
              const v = videoRef.current;
              if (v && !dragging) {
                setCurrentTime(v.currentTime);
                onPositionChange?.(v.currentTime);
              }
              if (
                v &&
                next !== null &&
                Math.abs(v.currentTime - next) >= 0.01
              ) {
                seekingRef.current = true;
                v.currentTime = next;
              }
            }}
            onError={() => {
              seekingRef.current = false;
              pendingSeekRef.current = null;
              setPlaying(false);
              setPlaybackError(
                "This replay could not be played. It may be incomplete or use an unsupported codec.",
              );
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        {/* Timeline scrubber */}
        <div className="flex items-center gap-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 1}
            step={0.1}
            aria-label="Playback position"
            onValueChange={([v]) => {
              // Keep dragging purely UI-local. Seeking on every pointer move
              // makes Chromium repeatedly fetch and decode GOPs, which can
              // retain large frame buffers long after the drag ends.
              setDragging(true);
              setCurrentTime(v);
            }}
            onValueCommit={([v]) => {
              setDragging(false);
              requestSeek(v, true);
            }}
            className="min-w-0 flex-1 cursor-pointer"
          />
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-surface-muted-foreground">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Transport */}
          <div className="flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1">
            <ControlBtn
              icon={<SkipBack className="h-3.5 w-3.5" />}
              title="Back 5s"
              onClick={() => seek(-5)}
            />
            <ControlBtn
              icon={
                playing ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )
              }
              title={playing ? "Pause" : "Play"}
              onClick={togglePlay}
              active={playing}
            />
            <ControlBtn
              icon={<SkipForward className="h-3.5 w-3.5" />}
              title="Forward 5s"
              onClick={() => seek(5)}
            />
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1.5 rounded-xl bg-surface-subtle p-1 pl-2.5">
            <span className="text-[11px] font-medium text-surface-muted-foreground">
              Speed
            </span>
            <Slider
              value={[speed]}
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={0.1}
              aria-label="Playback speed"
              onValueChange={([v]) => setSpeed(v)}
              className="w-20"
            />
            <span className="min-w-[2.5rem] text-center text-[11px] font-medium tabular-nums text-surface-muted-foreground">
              {speedLabel}
            </span>
            <ControlBtn
              icon={<RotateCcw className="h-3 w-3" />}
              title="Reset speed to 1×"
              onClick={() => setSpeed(SPEED_DEFAULT)}
              disabled={isDefaultSpeed}
            />
          </div>

          {/* Info + delete */}
          <div className="ml-auto flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1">
            <div
              className="flex items-center"
              onMouseEnter={loadInfo}
              onFocus={loadInfo}
            >
              <InfoTooltip
                side="left"
                ariaLabel="Replay information"
                iconClassName="h-7 w-7"
              >
                {info ? (
                  <div className="max-w-xs space-y-1 text-[11px]">
                    <p className="font-medium text-popover-foreground">
                      Replay Info
                    </p>
                    <div className="space-y-0.5 text-popover-foreground/70">
                      <p>
                        Resolution: {info.width}×{info.height}
                      </p>
                      <p>Frame rate: {Math.round(info.fps)} fps</p>
                      <p>Codec: {info.codec || "unknown"}</p>
                      <p>Duration: {fmtTime(info.durationSeconds)}</p>
                      <p>File size: {fmtBytes(info.sizeBytes)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-popover-foreground/70">
                    {infoUnavailable
                      ? "Replay info unavailable"
                      : "Loading replay info…"}
                  </p>
                )}
              </InfoTooltip>
            </div>
            {onExpand && (
              <ControlBtn
                icon={<Maximize2 className="h-3.5 w-3.5" />}
                title="Open replay fullscreen"
                onClick={() => onExpand(currentTime)}
              />
            )}
            <ControlBtn
              icon={<Download className="h-3.5 w-3.5" />}
              title="Export replay"
              onClick={handleExport}
              disabled={exporting}
            />
            <ControlBtn
              icon={<Trash2 className="h-3.5 w-3.5" />}
              title="Delete replay"
              onClick={() => setConfirmOpen(true)}
            />
          </div>
        </div>

        {exportFeedback && (
          <p
            className={cn(
              "text-[11px] leading-snug",
              exportFeedback.error
                ? "text-destructive"
                : "text-surface-muted-foreground",
            )}
          >
            {exportFeedback.text}
          </p>
        )}
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={closeDeleteModal}
        title="Delete Replay"
        width={380}
        height="auto"
      >
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-surface-muted-foreground">
            This will permanently delete the screen recording for this run. This
            can't be undone.
          </p>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={closeDeleteModal}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Small UI pieces ─── */

function ControlBtn({
  icon,
  title,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg transition-colors",
        disabled
          ? "text-surface-muted-foreground/30 cursor-default"
          : active
            ? "bg-surface-muted text-foreground"
            : "text-surface-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
