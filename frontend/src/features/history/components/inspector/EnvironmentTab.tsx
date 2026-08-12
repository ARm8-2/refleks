import { Button, InfoTooltip } from "@/shared/components";
import { translate, useI18n, type MessageKey } from "@/shared/lib";
import type { RunEnvironment } from "@/shared/types/ipc";
import { ArrowRightLeft, EyeOff, PinOff } from "lucide-react";
import {
  formatNumber,
  formatRunTimestamp,
  formatSessionTitle,
  type HistoryRun,
} from "../../lib/historyModels";
import { HeroStat, StatsGroup } from "./shared";

type EnvField = {
  labelKey: MessageKey;
  key?: keyof RunEnvironment;
  value?: (run: HistoryRun) => string;
  privacyNote?: MessageKey;
};

// Labels are catalog keys resolved at render time; the `key` values are
// RunEnvironment field names and never translate.
const ENV_GROUPS: Array<{ labelKey: MessageKey; fields: EnvField[] }> = [
  {
    labelKey: "history.env.groups.appOs",
    fields: [
      { labelKey: "history.env.fields.appVersion", key: "appVersion" },
      {
        labelKey: "history.env.fields.fileVersion",
        value: (run) => formatRunFileVersion(run.item.fileVersion),
      },
      { labelKey: "history.env.fields.os", key: "os" },
      { labelKey: "history.env.fields.arch", key: "arch" },
      { labelKey: "history.env.fields.osVersion", key: "osVersion" },
      {
        labelKey: "history.env.fields.steamId",
        key: "steamId",
        privacyNote: "history.env.privacyNote",
      },
      {
        labelKey: "history.env.fields.personaName",
        key: "personaName",
        privacyNote: "history.env.privacyNote",
      },
    ],
  },
  {
    labelKey: "history.env.groups.pcHardware",
    fields: [
      { labelKey: "history.env.fields.cpu", key: "cpuName" },
      { labelKey: "history.env.fields.cpuCores", key: "cpuCores" },
      { labelKey: "history.env.fields.gpu", key: "gpuName" },
      { labelKey: "history.env.fields.ramTotalMb", key: "ramTotalMB" },
    ],
  },
  {
    labelKey: "history.env.groups.displayContext",
    fields: [
      { labelKey: "history.env.fields.displayHz", key: "displayHz" },
      { labelKey: "history.env.fields.screenWidth", key: "screenWidth" },
      { labelKey: "history.env.fields.screenHeight", key: "screenHeight" },
      { labelKey: "history.env.fields.isWindowed", key: "isWindowed" },
    ],
  },
  {
    labelKey: "history.env.groups.mouseDevice",
    fields: [
      { labelKey: "history.env.fields.mouseBackend", key: "mouseBackend" },
      { labelKey: "history.env.fields.mouseVid", key: "mouseVid" },
      { labelKey: "history.env.fields.mousePid", key: "mousePid" },
      { labelKey: "history.env.fields.mouseMi", key: "mouseMi" },
    ],
  },
  {
    labelKey: "history.env.groups.traceMetadata",
    fields: [
      { labelKey: "history.env.fields.tracePoints", key: "tracePoints" },
      { labelKey: "history.env.fields.traceDuration", key: "traceDuration" },
      { labelKey: "history.env.fields.sampleRate", key: "sampleRate" },
    ],
  },
  {
    labelKey: "history.env.groups.diagnostics",
    fields: [{ labelKey: "history.env.fields.mouseName", key: "mouseName" }],
  },
];

function formatEnvValue(
  env: RunEnvironment,
  key: keyof RunEnvironment,
): string {
  const raw = env[key];

  if (key === "mouseVid" || key === "mousePid" || key === "mouseMi") {
    const id = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    return id ? `0x${id}` : "—";
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "—";
    if (key === "cpuCores") return `${Math.max(0, Math.trunc(raw))}`;
    if (key === "ramTotalMB")
      return formatNumber(Math.max(0, Math.trunc(raw)), 0);
    if (key === "screenWidth" || key === "screenHeight")
      return `${Math.max(0, Math.trunc(raw))}`;
    if (key === "tracePoints")
      return formatNumber(Math.max(0, Math.trunc(raw)), 0);
    if (key === "sampleRate") return `${Math.max(0, Math.trunc(raw))}`;
    if (key === "traceDuration" || key === "displayHz")
      return formatNumber(raw, 2);
    return formatNumber(raw);
  }

  if (typeof raw === "boolean") {
    return raw ? translate("common.yes") : translate("common.no");
  }

  if (typeof raw === "string") {
    const value = raw.trim();
    return value.length > 0 ? value : "—";
  }

  return "—";
}

function formatRunFileVersion(version: number | undefined): string {
  if (typeof version !== "number" || !Number.isFinite(version) || version <= 0)
    return "—";
  return `${Math.trunc(version)}`;
}

export function EnvironmentTab({
  primaryRun,
  compareRun,
  anonymousEnabled,
  onClearPrimaryRun,
  onClearComparison,
}: {
  primaryRun: HistoryRun;
  compareRun: HistoryRun | null;
  anonymousEnabled: boolean;
  onClearPrimaryRun: () => void;
  onClearComparison: () => void;
}) {
  return compareRun ? (
    <CompareEnvironmentView
      primaryRun={primaryRun}
      compareRun={compareRun}
      anonymousEnabled={anonymousEnabled}
      onClearPrimaryRun={onClearPrimaryRun}
      onClearComparison={onClearComparison}
    />
  ) : (
    <SingleEnvironmentView
      primaryRun={primaryRun}
      anonymousEnabled={anonymousEnabled}
      onClearPrimaryRun={onClearPrimaryRun}
    />
  );
}

function PrivacyHint({ note }: { note: string }) {
  return (
    <InfoTooltip
      side="top"
      className="max-w-56 text-center"
      icon={<EyeOff className="h-3.5 w-3.5" />}
    >
      {note}
    </InfoTooltip>
  );
}

function EnvironmentStatRow({
  label,
  value,
  privacyNote,
  showPrivacyHint,
}: {
  label: string;
  value: string;
  privacyNote?: string;
  showPrivacyHint: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-xs text-surface-muted-foreground">{label}</span>
        {showPrivacyHint && privacyNote && <PrivacyHint note={privacyNote} />}
      </div>
      <span className="text-sm font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function EnvironmentCompareStatRow({
  label,
  a,
  b,
  privacyNote,
  showPrivacyHint,
}: {
  label: string;
  a: string;
  b: string;
  privacyNote?: string;
  showPrivacyHint: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-xs text-surface-muted-foreground flex-shrink-0">
          {label}
        </span>
        {showPrivacyHint && privacyNote && <PrivacyHint note={privacyNote} />}
      </div>
      <div className="flex items-baseline gap-4 text-sm tabular-nums">
        <span className="font-medium text-foreground">{a}</span>
        <span className="font-medium text-foreground">{b}</span>
      </div>
    </div>
  );
}

function SingleEnvironmentView({
  primaryRun,
  anonymousEnabled,
  onClearPrimaryRun,
}: {
  primaryRun: HistoryRun;
  anonymousEnabled: boolean;
  onClearPrimaryRun: () => void;
}) {
  const { t } = useI18n();
  const env = primaryRun.item.env;

  return (
    <>
      <div className="min-w-0">
        <div className="font-medium text-foreground">
          {primaryRun.scenarioName}
        </div>
        <div className="mt-0.5 text-xs text-surface-muted-foreground">
          {formatRunTimestamp(primaryRun.playedAt)} ·{" "}
          {formatSessionTitle(primaryRun.session)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat label="VID" value={formatEnvValue(env, "mouseVid")} />
        <HeroStat label="PID" value={formatEnvValue(env, "mousePid")} />
        <HeroStat label="MI" value={formatEnvValue(env, "mouseMi")} />
        <HeroStat label="Backend" value={formatEnvValue(env, "mouseBackend")} />
      </div>

      {ENV_GROUPS.map((group) => (
        <StatsGroup key={group.labelKey} label={t(group.labelKey)}>
          {group.fields.map((field) => (
            <EnvironmentStatRow
              key={field.key ?? field.labelKey}
              label={t(field.labelKey)}
              value={
                field.value
                  ? field.value(primaryRun)
                  : formatEnvValue(env, field.key!)
              }
              privacyNote={
                field.privacyNote ? translate(field.privacyNote) : undefined
              }
              showPrivacyHint={anonymousEnabled}
            />
          ))}
        </StatsGroup>
      ))}
    </>
  );
}

function CompareEnvironmentView({
  primaryRun,
  compareRun,
  anonymousEnabled,
  onClearPrimaryRun,
  onClearComparison,
}: {
  primaryRun: HistoryRun;
  compareRun: HistoryRun;
  anonymousEnabled: boolean;
  onClearPrimaryRun: () => void;
  onClearComparison: () => void;
}) {
  const { t } = useI18n();
  const primaryEnv = primaryRun.item.env;
  const compareEnv = compareRun.item.env;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-surface-subtle px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-surface-muted-foreground">
              {t("history.inspector.pinned")}
            </div>
            <div className="mt-0.5 font-medium text-foreground truncate">
              {primaryRun.scenarioName}
            </div>
            <div className="text-[0.6875rem] text-surface-muted-foreground">
              {formatRunTimestamp(primaryRun.playedAt)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onClearPrimaryRun}
          >
            <PinOff className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-start justify-between gap-2 rounded-xl bg-surface-subtle px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-surface-muted-foreground">
              {t("history.inspector.compare")}
            </div>
            <div className="mt-0.5 font-medium text-foreground truncate">
              {compareRun.scenarioName}
            </div>
            <div className="text-[0.6875rem] text-surface-muted-foreground">
              {formatRunTimestamp(compareRun.playedAt)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onClearComparison}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {ENV_GROUPS.map((group) => (
        <StatsGroup key={group.labelKey} label={t(group.labelKey)}>
          {group.fields.map((field) => (
            <EnvironmentCompareStatRow
              key={field.key ?? field.labelKey}
              label={t(field.labelKey)}
              a={
                field.value
                  ? field.value(primaryRun)
                  : formatEnvValue(primaryEnv, field.key!)
              }
              b={
                field.value
                  ? field.value(compareRun)
                  : formatEnvValue(compareEnv, field.key!)
              }
              privacyNote={
                field.privacyNote
                  ? translate(field.privacyNote as MessageKey)
                  : undefined
              }
              showPrivacyHint={anonymousEnabled}
            />
          ))}
        </StatsGroup>
      ))}
    </>
  );
}
