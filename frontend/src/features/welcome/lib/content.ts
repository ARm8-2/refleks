import { translate } from "@/shared/lib/i18n";
import { EXTERNAL_LINKS } from "@/shared/lib";

export type WelcomeContent = {
  title: string;
  intro: string;
  details: string[];
  highlightsTitle: string;
  highlights: string[];
  linksTitle: string;
  links: WelcomeLink[];
  ctaLabel: string;
};

export type WelcomeLink = {
  label: string;
  description: string;
  url: string;
  urlLabel: string;
};

function resolveLinks(): WelcomeLink[] {
  return [
    {
      label: translate("welcome.content.links.docsLabel"),
      description: translate("welcome.content.links.docsDescription"),
      url: EXTERNAL_LINKS.docs,
      urlLabel: "refleksapp.com/docs/",
    },
    {
      label: translate("welcome.content.links.changelogLabel"),
      description: translate("welcome.content.links.changelogDescription"),
      url: EXTERNAL_LINKS.changelog,
      urlLabel: "refleksapp.com/changelog/",
    },
  ];
}

export function resolveWelcomeContent(
  currentVersion: string,
  previousVersion: string,
): WelcomeContent {
  const trimmedCurrent = currentVersion.trim();
  const trimmedPrevious = previousVersion.trim();
  const isFirstLaunch = trimmedPrevious === "";

  return {
    title: translate(
      isFirstLaunch
        ? "welcome.content.titleFirstLaunch"
        : "welcome.content.titleUpgrade",
      { version: trimmedCurrent },
    ),
    intro: translate(
      isFirstLaunch
        ? "welcome.content.introFirstLaunch"
        : "welcome.content.introUpgrade",
    ),
    details: [translate("welcome.content.details")],
    highlightsTitle: translate("welcome.content.highlightsTitle"),
    highlights: [
      translate("welcome.content.highlights.changelog"),
      translate("welcome.content.highlights.docs"),
      translate("welcome.content.highlights.customize"),
      translate("welcome.content.highlights.community"),
    ],
    linksTitle: translate("welcome.content.linksTitle"),
    links: resolveLinks(),
    ctaLabel: translate(
      isFirstLaunch
        ? "welcome.content.ctaFirstLaunch"
        : "welcome.content.ctaUpgrade",
    ),
  };
}
