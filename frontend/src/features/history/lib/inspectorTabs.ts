import type { MessageKey } from "@/shared/lib";

export type InspectorTab =
  "stats" | "analysis" | "trace" | "replay" | "environment";

// Values are persisted state (never translated); only labels are catalogued
// and resolved with `t()` at render time by the inspector.
export const INSPECTOR_TABS: Array<{
  value: InspectorTab;
  labelKey: MessageKey;
}> = [
  { value: "stats", labelKey: "history.inspector.tabs.stats" },
  { value: "analysis", labelKey: "history.inspector.tabs.analysis" },
  { value: "trace", labelKey: "history.inspector.tabs.trace" },
  { value: "replay", labelKey: "history.inspector.tabs.replay" },
  { value: "environment", labelKey: "history.inspector.tabs.environment" },
];
