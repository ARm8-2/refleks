import { Button, InfoTooltip, Modal } from "@/shared/components";
import { Slider } from "@/shared/components/ui/slider";
import { deleteRunReplay, getRunReplay, getRunReplayInfo } from "@/shared/lib";
import { cn } from "@/shared/lib/utils";
import type { ReplayFileInfo } from "@/shared/types/ipc";
import {
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
// encode time. Poll for a just-finished run's replay instead of checking
// only once, so the tab picks it up on its own instead of requiring the user
// to click away and back. Give up well before that window for runs that are
// already old, so runs that never had (or never will have) a recording don't
// sit on a loading state.
const REPLAY_POLL_INTERVAL_MS = 2_000;
const REPLAY_READY_WINDOW_MS = 90_000;
// Debounce the actual replay lookup/load after the selected run changes.
// Clicking through several runs quickly would otherwise mount (fetch +
// decode) and immediately tear down a video for every run passed through
// along the way — each cycle briefly holds real decoder memory, and doing
// that for every intermediate click adds up to visible, avoidable churn.
// Waiting for the selection to settle means only the run the user actually
// stops on ever loads a video.
const REPLAY_SELECT_DEBOUNCE_MS = 200;

function stillWithinReadyWindow(playedAt: number): boolean {
  const age = Date.now() - playedAt;
  return playedAt > 0 && age >= 0 && age < REPLAY_READY_WINDOW_MS;
}

export function ReplayTab({ primaryRun, compareRun }: Props) {
  const [primaryReplay, setPrimaryReplay] = useState<ReplaySource | null>(null);
  const [compareReplay, setCompareReplay] = useState<ReplaySource | null>(null);
  const [primaryWaiting, setPrimaryWaiting] = useState(true);
  const [compareWaiting, setCompareWaiting] = useState(false);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let primaryPath: string | null = null;
    let comparePath: string | null = null;
    let primaryResolved = false;
    let compareResolved = !compareRun;

    setPrimaryReplay(null);
    setCompareReplay(null);
    setPrimaryWaiting(true);
    setCompareWaiting(!!compareRun);

    const poll = async () => {
      // Once a slot has resolved, keep its URL and only poll the slot that is
      // still processing. This avoids repeated IPC/filesystem work and React
      // updates while the other replay catches up.
      const lookups: PromiseSettledResult<string | null>[] =
        await Promise.allSettled([
          primaryResolved
            ? Promise.resolve(primaryPath)
            : getRunReplay(primaryRun.item.filePath),
          compareResolved || !compareRun
            ? Promise.resolve(comparePath)
            : getRunReplay(compareRun.item.filePath),
        ]);
      if (!active) return;

      const [primaryResult, compareResult] = lookups;
      if (primaryResult.status === "fulfilled") {
        primaryPath = primaryResult.value;
        primaryResolved = primaryPath !== null;
        if (primaryPath !== null) {
          setPrimaryReplay({
            filePath: primaryRun.item.filePath,
            path: primaryPath,
          });
        }
      }
      if (compareRun && compareResult.status === "fulfilled") {
        comparePath = compareResult.value;
        compareResolved = comparePath !== null;
        if (comparePath !== null) {
          setCompareReplay({
            filePath: compareRun.item.filePath,
            path: comparePath,
          });
        }
      }

      const keepPrimaryWaiting =
        !primaryResolved && stillWithinReadyWindow(primaryRun.playedAt);
      const keepCompareWaiting =
        !!compareRun &&
        !compareResolved &&
        stillWithinReadyWindow(compareRun.playedAt);
      setPrimaryWaiting(keepPrimaryWaiting);
      setCompareWaiting(keepCompareWaiting);

      if (keepPrimaryWaiting || keepCompareWaiting) {
        pollTimer = setTimeout(poll, REPLAY_POLL_INTERVAL_MS);
      }
    };

    const debounceTimer = setTimeout(poll, REPLAY_SELECT_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [
    primaryRun.item.filePath,
    primaryRun.playedAt,
    compareRun?.item.filePath,
    compareRun?.playedAt,
  ]);

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
  label,
  onDeleted,
}: {
  filePath: string;
  path: string | null;
  waiting: boolean;
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
          ? "Waiting for replay to finish processing…"
          : "No screen recording for this run. Enable screen capture in settings to record replays."}
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
              icon={<Trash2 className="h-3.5 w-3.5" />}
              title="Delete replay"
              onClick={() => setConfirmOpen(true)}
            />
          </div>
        </div>
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
