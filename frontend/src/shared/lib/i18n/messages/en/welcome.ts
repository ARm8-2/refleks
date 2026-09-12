import { WidenDeep } from "../types";

/**
 * Welcome feature strings (welcome content resolver + WelcomeModal).
 * Product names (RefleK's, KovaaK's, Steam, FFmpeg, the RefleK's Index)
 * stay as-is inside translated text.
 */
export const welcome = {
  content: {
    titleFirstLaunch: "Welcome to RefleK's v{version}",
    titleUpgrade: "Welcome back to RefleK's v{version}",
    introFirstLaunch:
      "Thank you for installing RefleK's. Check out the changelog and docs to get up to speed with the latest features and improvements.",
    introUpgrade:
      "Welcome back. Check out the changelog to see what's new in this release.",
    details:
      "For detailed information about what's changed, features, and improvements, please visit the changelog linked below. It's always kept up to date with the latest release notes.",
    highlightsTitle: "Getting Started",
    highlights: {
      changelog:
        "Visit the changelog for detailed release information and feature updates.",
      docs: "Check the documentation for guides, walkthroughs, and troubleshooting.",
      customize:
        "Customize your preferences in Settings to tailor RefleK's to your needs.",
      community: "Join the community and share your experience.",
    },
    linksTitle: "Resources",
    ctaFirstLaunch: "Start exploring",
    ctaUpgrade: "Jump back in",
    links: {
      docsLabel: "Browse the docs",
      docsDescription:
        "Setup guides, walkthroughs, and troubleshooting for RefleK's.",
      changelogLabel: "Read the changelog",
      changelogDescription:
        "See the fuller release history and version-by-version notes in the browser.",
    },
  },
  modal: {
    syncStatusEnabled:
      "Run Sync is currently enabled. You can change this later in Privacy settings.",
    syncStatusDisabled:
      "Run Sync is currently turned off in Settings. If you enable it later, this choice will be used.",
    sectionFirstTime: "First-Time Setup",
    sectionProfile: "Profile Settings",
    sectionReview: "Settings",
    sectionFirstTimeDescription:
      "Pick how you want your uploads and mouse traces to start. You can change these choices later in Settings.",
    sectionProfileDescription:
      "Choose how you want your runs to appear on the RefleK's Index. You can change this later in Privacy settings.",
    sectionReviewDescription:
      "Review your current settings. You can change these anytime in the Settings panel.",
    recommended: "Recommended",
    later: "Later",
    private: "Private",
    index: {
      label: "RefleK's Index",
      description:
        "Completed runs can be uploaded to the RefleK's Index, a shared dataset that feeds rankings, comparisons, and research across the global player base.",
    },
    publicProfile: {
      label: "Public Profile",
      subtitle: "Show my Steam name on the Index.",
      description:
        "Best if you want your Steam name shown with the runs you upload.",
      bullets: [
        "Your Steam name appears on runs you upload to the Index.",
        "You can switch to Anonymous later in Privacy settings.",
      ],
    },
    anonymous: {
      label: "Anonymous",
      subtitle: "Private identity, shared contribution.",
      description:
        "Best if you want to contribute data while keeping identifying information out of uploads.",
      bullets: [
        "Steam ID and persona name are scrubbed before upload.",
        "Your runs still help the shared dataset, analysis, and research.",
        "You can switch back to Public later in Privacy settings.",
      ],
    },
    mouseTraces: {
      label: "Mouse Traces",
      description:
        "Mouse traces capture your movement during runs so you can replay and compare them later. Tracing is designed to have no performance impact during play.",
      helper:
        "This is just your starting point — you can change it later in General settings.",
      enabled: {
        label: "Enable Mouse Traces",
        subtitle: "Capture movement during supported runs.",
        description:
          "Best if you want richer history and replay tools from your very first session.",
        bullets: [
          "No performance impact during play.",
          "Lets you replay and compare runs in the History view.",
          "Can be turned off anytime in General settings.",
        ],
      },
      disabled: {
        label: "Not Right Now",
        subtitle: "Start without trace capture and enable it whenever you want.",
        description:
          "A good starting point if you want to get familiar with the app first and decide about traces after a few sessions.",
        bullets: [
          "Keeps first-time setup simple.",
          "Enable traces anytime later in General settings.",
          "The rest of the app works the same either way.",
        ],
      },
    },
    screenReplay: {
      label: "Screen Replay",
      description:
        "Record a video replay of your runs so you can rewatch and analyze your crosshair placement, movement, and decision-making directly in the app.",
      helper:
        "Requires FFmpeg. Can be changed later in General settings.",
      enabled: {
        label: "Enable Replay Recording",
        subtitle: "Capture screen during runs (hardware accelerated).",
        description:
          "Best if you want to visually review your gameplay alongside your stats and mouse trace.",
        bullets: [
          "Records at 30 fps with hardware GPU encoding — zero CPU impact.",
          "Replays appear as a new tab in the run inspector after each match.",
          "Can be turned off anytime in General settings.",
        ],
      },
      disabled: {
        label: "Start Without Recording",
        subtitle: "Begin with mouse tracking only and add screen replays whenever.",
        description:
          "A low-friction starting point. You can enable replay recording later once you're comfortable with the app.",
        bullets: [
          "Keeps first-time setup simple.",
          "Mouse traces and all other features still work.",
          "Enable screen capture anytime in General settings.",
        ],
      },
    },
    resourcesDescription:
      "If you want the full release story, the changelog and docs are always only a click away.",
  },
} as const;

export type WelcomeMessages = WidenDeep<typeof welcome>;
