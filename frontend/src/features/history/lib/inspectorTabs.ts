export type InspectorTab =
  "stats" | "analysis" | "trace" | "replay" | "environment";

export const INSPECTOR_TABS: Array<{ value: InspectorTab }> = [
  { value: "stats" },
  { value: "analysis" },
  { value: "trace" },
  { value: "replay" },
  { value: "environment" },
];
