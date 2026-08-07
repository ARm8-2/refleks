import { i18n } from "@/i18n";
import { Button, InfoTooltip } from "@/shared/components";
import type { RunEnvironment } from "@/shared/types/ipc";
import { ArrowRightLeft, EyeOff, PinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  formatNumber,
  formatRunTimestamp,
  formatSessionTitle,
  type HistoryRun,
} from "../../lib/historyModels";
import { HeroStat, StatsGroup } from "./shared";

type EnvFieldLabelKey =
  | "environment.fields.appVersion" | "environment.fields.fileVersion"
  | "environment.fields.os" | "environment.fields.architecture"
  | "environment.fields.osVersion" | "environment.fields.steamId"
  | "environment.fields.personaName" | "environment.fields.cpu"
  | "environment.fields.cpuCores" | "environment.fields.gpu"
  | "environment.fields.ramTotal" | "environment.fields.refreshRate"
  | "environment.fields.screenWidth" | "environment.fields.screenHeight"
  | "environment.fields.windowed" | "environment.fields.inputBackend"
  | "environment.fields.vendorId" | "environment.fields.productId"
  | "environment.fields.interface" | "environment.fields.tracePoints"
  | "environment.fields.traceDuration" | "environment.fields.sampleRate"
  | "environment.fields.mousePath";

type EnvGroupLabelKey =
  | "environment.groups.appOs" | "environment.groups.hardware"
  | "environment.groups.display" | "environment.groups.mouse"
  | "environment.groups.trace" | "environment.groups.diagnostics";

type EnvField = {
  labelKey: EnvFieldLabelKey;
  key?: keyof RunEnvironment;
  value?: (run: HistoryRun) => string;
  private?: boolean;
};

const ENV_GROUPS: Array<{ labelKey: EnvGroupLabelKey; fields: EnvField[] }> = [
  {
    labelKey: "environment.groups.appOs",
    fields: [
      { labelKey: "environment.fields.appVersion", key: "appVersion" },
      {
        labelKey: "environment.fields.fileVersion",
        value: (run) => formatRunFileVersion(run.item.fileVersion),
      },
      { labelKey: "environment.fields.os", key: "os" },
      { labelKey: "environment.fields.architecture", key: "arch" },
      { labelKey: "environment.fields.osVersion", key: "osVersion" },
      {
        labelKey: "environment.fields.steamId",
        key: "steamId",
        private: true,
      },
      {
        labelKey: "environment.fields.personaName",
        key: "personaName",
        private: true,
      },
    ],
  },
  {
    labelKey: "environment.groups.hardware",
    fields: [
      { labelKey: "environment.fields.cpu", key: "cpuName" },
      { labelKey: "environment.fields.cpuCores", key: "cpuCores" },
      { labelKey: "environment.fields.gpu", key: "gpuName" },
      { labelKey: "environment.fields.ramTotal", key: "ramTotalMB" },
    ],
  },
  {
    labelKey: "environment.groups.display",
    fields: [
      { labelKey: "environment.fields.refreshRate", key: "displayHz" },
      { labelKey: "environment.fields.screenWidth", key: "screenWidth" },
      { labelKey: "environment.fields.screenHeight", key: "screenHeight" },
      { labelKey: "environment.fields.windowed", key: "isWindowed" },
    ],
  },
  {
    labelKey: "environment.groups.mouse",
    fields: [
      { labelKey: "environment.fields.inputBackend", key: "mouseBackend" },
      { labelKey: "environment.fields.vendorId", key: "mouseVid" },
      { labelKey: "environment.fields.productId", key: "mousePid" },
      { labelKey: "environment.fields.interface", key: "mouseMi" },
    ],
  },
  {
    labelKey: "environment.groups.trace",
    fields: [
      { labelKey: "environment.fields.tracePoints", key: "tracePoints" },
      { labelKey: "environment.fields.traceDuration", key: "traceDuration" },
      { labelKey: "environment.fields.sampleRate", key: "sampleRate" },
    ],
  },
  {
    labelKey: "environment.groups.diagnostics",
    fields: [{ labelKey: "environment.fields.mousePath", key: "mouseName" }],
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
    return raw
      ? i18n.t("history:environment.yes")
      : i18n.t("history:environment.no");
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
  const { t } = useTranslation("history");
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
        <HeroStat label={t("environment.fields.backend")} value={formatEnvValue(env, "mouseBackend")} />
      </div>

      {ENV_GROUPS.map((group) => (
        <StatsGroup key={group.labelKey} label={t(group.labelKey)}>
          {group.fields.map((field) => (
            <EnvironmentStatRow
              key={field.labelKey}
              label={t(field.labelKey)}
              value={
                field.value
                  ? field.value(primaryRun)
                  : formatEnvValue(env, field.key!)
              }
              privacyNote={field.private ? t("environment.privateLocal") : undefined}
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
  const { t } = useTranslation("history");
  const primaryEnv = primaryRun.item.env;
  const compareEnv = compareRun.item.env;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-surface-subtle px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-surface-muted-foreground">{t("inspector.pinned")}</div>
            <div className="mt-0.5 font-medium text-foreground truncate">
              {primaryRun.scenarioName}
            </div>
            <div className="text-[11px] text-surface-muted-foreground">
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
            <div className="text-xs text-surface-muted-foreground">{t("inspector.compare")}</div>
            <div className="mt-0.5 font-medium text-foreground truncate">
              {compareRun.scenarioName}
            </div>
            <div className="text-[11px] text-surface-muted-foreground">
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
              key={field.labelKey}
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
              privacyNote={field.private ? t("environment.privateLocal") : undefined}
              showPrivacyHint={anonymousEnabled}
            />
          ))}
        </StatsGroup>
      ))}
    </>
  );
}
