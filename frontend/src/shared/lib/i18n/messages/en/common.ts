import { WidenDeep } from "../types";

/**
 * Strings shared across features: navigation, generic actions, and strings
 * embedded in shared components. Keep feature-specific copy in the matching
 * namespace file instead of here.
 */
export const common = {
  nav: {
    primary: "Primary",
    secondary: "Secondary",
    overview: "Overview",
    history: "History",
    benchmarks: "Benchmarks",
    favorites: "Favorites",
    help: "Help",
    support: "Support",
    settings: "Settings",
  },
  actions: {
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    reset: "Reset",
    delete: "Delete",
    deleting: "Deleting…",
    close: "Close",
    back: "Back",
    edit: "Edit",
    reload: "Reload",
    dismiss: "Dismiss",
    expand: "Expand",
    all: "All",
    none: "None",
    unlimited: "Unlimited",
  },
  search: "Search...",
  loading: "Loading...",
  unknown: "Unknown",
  yes: "Yes",
  no: "No",
  missingValue: "N/A",
  errorBoundary: {
    title: "Something went wrong.",
    reload: "Reload",
    dismiss: "Dismiss",
  },
  widget: {
    expand: "Expand",
    noSessionLoaded: "No session loaded",
  },
  dialog: {
    close: "Close",
  },
  infoTooltip: {
    ariaLabel: "More information",
  },
} as const;

export type CommonMessages = WidenDeep<typeof common>;
