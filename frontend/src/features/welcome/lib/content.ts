import { EXTERNAL_LINKS } from "@/shared/lib";

export type WelcomeContent = {
  currentVersion: string;
  isFirstLaunch: boolean;
  links: WelcomeLink[];
};

export type WelcomeLink = {
  kind: "docs" | "changelog";
  url: string;
  urlLabel: string;
};

const RESOURCE_LINKS: WelcomeLink[] = [
  {
    kind: "docs",
    url: EXTERNAL_LINKS.docs,
    urlLabel: "refleksapp.com/docs/",
  },
  {
    kind: "changelog",
    url: EXTERNAL_LINKS.changelog,
    urlLabel: "refleksapp.com/changelog/",
  },
];

export function resolveWelcomeContent(
  currentVersion: string,
  previousVersion: string,
): WelcomeContent {
  const trimmedCurrent = currentVersion.trim();
  const trimmedPrevious = previousVersion.trim();

  return {
    currentVersion: trimmedCurrent,
    isFirstLaunch: trimmedPrevious === "",
    links: RESOURCE_LINKS,
  };
}
