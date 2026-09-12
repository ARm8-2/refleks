import type { WelcomeMessages } from "../en/welcome";

/**
 * Nederlandse vertalingen voor het welkomstscherm.
 */
export const welcome: WelcomeMessages = {
  content: {
    titleFirstLaunch: "Welkom bij RefleK's v{version}",
    titleUpgrade: "Welkom terug bij RefleK's v{version}",
    introFirstLaunch:
      "Bedankt voor het installeren van RefleK's. Bekijk de changelog en documentatie om op de hoogte te raken van de nieuwste functies en verbeteringen.",
    introUpgrade:
      "Welkom terug. Bekijk de changelog om te zien wat er nieuw is in deze release.",
    details:
      "Voor gedetailleerde informatie over wat er is veranderd, functies en verbeteringen, bezoek je de hieronder gelinkte changelog. Deze wordt altijd up-to-date gehouden met de nieuwste release-opmerkingen.",
    highlightsTitle: "Aan de slag",
    highlights: {
      changelog:
        "Bezoek de changelog voor gedetailleerde release-informatie en functie-updates.",
      docs: "Raadpleeg de documentatie voor handleidingen, walkthroughs en probleemoplossing.",
      customize:
        "Pas je voorkeuren aan in Instellingen om RefleK's naar wens in te richten.",
      community: "Sluit je aan bij de community en deel je ervaring.",
    },
    linksTitle: "Bronnen",
    ctaFirstLaunch: "Begin met verkennen",
    ctaUpgrade: "Spring terug in",
    links: {
      docsLabel: "Documentatie bekijken",
      docsDescription:
        "Installatiehandleidingen, walkthroughs en probleemoplossing voor RefleK's.",
      changelogLabel: "Changelog lezen",
      changelogDescription:
        "Bekijk de volledige releasegeschiedenis en versie-voor-versie-opmerkingen in de browser.",
    },
  },
  modal: {
    syncStatusEnabled:
      "Run-synchronisatie is momenteel ingeschakeld. Je kunt dit later wijzigen in de privacy-instellingen.",
    syncStatusDisabled:
      "Run-synchronisatie is momenteel uitgeschakeld in de instellingen. Als je het later inschakelt, wordt deze keuze gebruikt.",
    sectionFirstTime: "Eerste installatie",
    sectionProfile: "Profielinstellingen",
    sectionReview: "Instellingen",
    sectionFirstTimeDescription:
      "Kies hoe je uploads en muisregistraties moeten starten. Je kunt deze keuzes later wijzigen in de instellingen.",
    sectionProfileDescription:
      "Kies hoe je runs op de RefleK's Index verschijnen. Je kunt dit later wijzigen in de privacy-instellingen.",
    sectionReviewDescription:
      "Bekijk je huidige instellingen. Je kunt deze op elk moment wijzigen in het instellingenpaneel.",
    recommended: "Aanbevolen",
    later: "Later",
    private: "Privé",
    index: {
      label: "RefleK's Index",
      description:
        "Voltooide runs kunnen worden geüpload naar de RefleK's Index, een gedeelde dataset die rankings, vergelijkingen en onderzoek binnen de wereldwijde spelersbasis voedt.",
    },
    publicProfile: {
      label: "Openbaar profiel",
      subtitle: "Toon mijn Steam-naam op de Index.",
      description:
        "Het beste als je wilt dat je Steam-naam wordt getoond bij de runs die je uploadt.",
      bullets: [
        "Je Steam-naam verschijnt bij runs die je naar de Index uploadt.",
        "Je kunt later overschakelen naar Anoniem in de privacy-instellingen.",
      ],
    },
    anonymous: {
      label: "Anoniem",
      subtitle: "Privé-identiteit, gedeelde bijdrage.",
      description:
        "Het beste als je gegevens wilt bijdragen terwijl herkenbare informatie buiten de uploads blijft.",
      bullets: [
        "Steam-ID en personanaam worden vóór de upload verwijderd.",
        "Je runs helpen nog steeds de gedeelde dataset, analyse en het onderzoek.",
        "Je kunt later terugschakelen naar Openbaar in de privacy-instellingen.",
      ],
    },
    mouseTraces: {
      label: "Muisregistraties",
      description:
        "Muisregistraties leggen je beweging tijdens runs vast, zodat je ze later kunt terugkijken en vergelijken. Registratie is ontworpen zonder prestatie-impact tijdens het spelen.",
      helper:
        "Dit is slechts je startpunt — je kunt het later wijzigen in de algemene instellingen.",
      enabled: {
        label: "Muisregistratie inschakelen",
        subtitle: "Neem beweging op tijdens ondersteunde runs.",
        description:
          "Het beste als je vanaf je allereerste sessie rijkere geschiedenis en replay-tools wilt.",
        bullets: [
          "Geen prestatie-impact tijdens het spelen.",
          "Laat je runs terugkijken en vergelijken in de geschiedenismodule.",
          "Kan op elk moment worden uitgeschakeld in de algemene instellingen.",
        ],
      },
      disabled: {
        label: "Nog niet nu",
        subtitle: "Start zonder registratie en schakel het in wanneer je wilt.",
        description:
          "Een goed startpunt als je eerst de app wilt leren kennen en na een paar sessies over registratie wilt beslissen.",
        bullets: [
          "Houdt de eerste installatie eenvoudig.",
          "Schakel registratie later in via de algemene instellingen.",
          "De rest van de app werkt in beide gevallen hetzelfde.",
        ],
      },
    },
    screenReplay: {
      label: "Schermreplay",
      description:
        "Neem een videoreplay van je runs op, zodat je je crosshair-plaatsing, beweging en besluitvorming direct in de app kunt terugkijken en analyseren.",
      helper:
        "Vereist FFmpeg. Kan later worden gewijzigd in de algemene instellingen.",
      enabled: {
        label: "Replay-opname inschakelen",
        subtitle: "Neem het scherm op tijdens runs (hardwarematig versneld).",
        description:
          "Het beste als je je gameplay visueel wilt beoordelen naast je statistieken en muisregistratie.",
        bullets: [
          "Neemt op met 30 fps en hardware-GPU-codering — nul CPU-impact.",
          "Replays verschijnen na elke match als nieuw tabblad in de run-inspecteur.",
          "Kan op elk moment worden uitgeschakeld in de algemene instellingen.",
        ],
      },
      disabled: {
        label: "Zonder opname starten",
        subtitle: "Begin alleen met muisregistratie en voeg schermreplays later toe.",
        description:
          "Een laagdrempelig startpunt. Je kunt replay-opname later inschakelen zodra je vertrouwd bent met de app.",
        bullets: [
          "Houdt de eerste installatie eenvoudig.",
          "Muisregistraties en alle andere functies blijven werken.",
          "Schakel schermopname op elk moment in via de algemene instellingen.",
        ],
      },
    },
    resourcesDescription:
      "Als je het volledige releaseverhaal wilt, zijn de changelog en documentatie altijd maar één klik verwijderd.",
  },
};
