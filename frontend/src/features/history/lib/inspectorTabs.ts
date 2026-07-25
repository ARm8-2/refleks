export type InspectorTab =
  "stats" | "analysis" | "trace" | "replay" | "environment";

export const INSPECTOR_TABS: Array<{ value: InspectorTab; label: string }> = [
  { value: "stats", label: "Stats" },
  { value: "analysis", label: "Analysis" },
  { value: "trace", label: "Trace" },
  { value: "replay", label: "Replay" },
  { value: "environment", label: "Environment" },
];
