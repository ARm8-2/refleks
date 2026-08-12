import type { BenchmarksMessages } from "../en/benchmarks";

/**
 * Nederlandse vertalingen voor de benchmarksfunctie. Namen van benchmarks,
 * scenario's, categorieën, groepen en ranks (spelgegevens) blijven onvertaald;
 * alleen de UI-labels eromheen worden vertaald. Gamingtermen die Nederlandse
 * spelers gebruiken (Rank, Score, PB) blijven onvertaald.
 */
export const benchmarks: BenchmarksMessages = {
  explore: {
    title: "Benchmarks",
    sort: "Sorteren",
    group: "Groeperen",
    random: "Willekeurig",
    randomTitle: "Open een willekeurige benchmark",
    showAll: "Alle benchmarks tonen",
    showFavoritesOnly: "Alleen favorieten tonen",
    favorites: "Favorieten",
    recommended: "Aanbevolen",
    hideRecommendations: "Aanbevelingen verbergen",
    showRecommended: "Aanbevolen benchmarks tonen",
    loadingRecommendations:
      "Benchmarkvoortgang laden voor aanbevelingen...",
    emptySyncing:
      "Wachten tot de benchmarkcatalogus klaar is met synchroniseren...",
    emptyFavorites:
      "Nog geen favoriete benchmarks. Ster een benchmark om hem hier toe te voegen.",
    emptySearch: "Geen benchmarks die overeenkomen met je zoekopdracht.",
    emptyAll: "Geen benchmarks gevonden.",
    sortOptions: {
      name: "Naam",
      abbreviation: "Afkorting",
      dateAdded: "Datum toegevoegd",
    },
    groupOptions: {
      abbreviation: "Afkorting",
      category: "Categorie",
    },
    categories: {
      aim: "Aim-groepen",
      community: "Community-benchmarks",
      notable: "Opmerkelijke creator-benchmarks",
      other: "Overig",
    },
  },
  detail: {
    difficulty: "Moeilijkheidsgraad",
    playPlaylist: "Benchmark-playlist afspelen in KovaaK's",
    copied: "Gekopieerd!",
    copyScreenshot: "Voortgangstabel als screenshot kopiëren",
    favorite: "Benchmark favoriet maken",
    unfavorite: "Benchmark niet meer favoriet",
    notFound: "Benchmark niet gevonden.",
    unknownDifficulty: "Onbekende moeilijkheidsgraad",
    noProgress:
      "Nog geen voortgangsgegevens voor deze moeilijkheidsgraad.",
    clipboardUnsupported:
      "Afbeeldingsklembord wordt niet ondersteund in deze omgeving.",
    copyFailed: "Screenshot kopiëren mislukt.",
  },
  progressTable: {
    title: "Voortgangstracker",
    snapshot: "Momentopname van benchmarkvoortgang",
    compact: "Compact",
    enableCompact: "Compacte modus inschakelen",
    disableCompact: "Compacte modus uitschakelen",
    lastPlayed: "Laatst gespeeld",
    showLastPlayed: "Laatst-gespeeld-markering tonen",
    hideLastPlayed: "Laatst-gespeeld-markering verbergen",
    viewSettings: "Trackerinstellingen bekijken",
    columnScenario: "Scenario",
    columnRec: "Aanb.",
    columnScore: "Score",
    details: "Details",
    settingsTitle: "Trackerinstellingen",
    featureColumns: "Functiekolommen",
    columnLabelNotes: "Notities",
    columnLabelRecommendations: "Aanbevelingen",
    columnLabelPlay: "Afspelen",
    columnLabelHistory: "Geschiedenis",
    rankVisibility: "Rankzichtbaarheid",
    autoHideCleared: "Eerder behaalde ranks automatisch verbergen",
    keepVisible: "Zichtbaar houden:",
    resetManual: "Handmatig resetten",
    hiddenAutoTitle:
      "Automatisch verborgen omdat elk scenario al voorbij deze rank is",
  },
  rankDistribution: {
    title: "Rankverdeling",
    scopeCategory: "Categorie",
    scopeSubcategory: "Subcategorie",
    descriptionAll:
      "Hoe je scenario's zijn verdeeld over de rankniveaus.",
    descriptionCategory: "Categoriebereik: {name}",
    descriptionSubcategory: "Subcategoriebereik: {name}",
    groupFallback: "Groep {number}",
    belowR1: "Onder R1",
    noData: "Geen gegevens.",
    donutAriaLabel: "Rankverdeling-donut",
    scenarios: "Scenario's",
  },
  strength: {
    title: "Sterkte-analyse",
    scopeCategory: "Categorie",
    scopeSubcategory: "Subcategorie",
    scopeScenario: "Scenario",
    description: "Voortgang op {level}-niveau naar de hoogste rank.",
    unranked: "Niet gerangschikt",
    noData: "Geen gegevens.",
    avg: "Gem.",
  },
  recommendationInfo: {
    ariaLabel: "Over aanbevelingen",
    title: "Aanbevelingen",
    description:
      "Welke scenario's nu de moeite waard zijn om te spelen, op basis van je voortgang, recente scoretrends en hoe lang geleden je elk scenario hebt gespeeld.",
    completed: "Voltooid — hoogste rank bereikt",
    topPick: "Topkeuze — speel dit nu",
    stronglyRecommended: "Sterk aanbevolen",
    recommended: "Aanbevolen — onder gemiddelde of verbeterend",
    neutral: "Neutraal",
    lowPriority: "Lage prioriteit",
    avoid: "Vermijd voor nu — sterk of dalend",
  },
  scenarioHistory: {
    title: "Scenariogeschiedenis · {scenario}",
    score: "Score",
    noScores: "Geen scores gevonden.",
  },
  scenarioNotes: {
    trainingSensitivity: "Trainingsgevoeligheid",
    sensPlaceholder: "bijv. 35,8 cm of 0,5",
    copySensitivity: "Gevoeligheid kopiëren",
    notesLabel: "Notities",
    notesPlaceholder:
      "Leg je strategie, zwakke punten en aandachtspunten vast...",
  },
  scenarioRow: {
    notesSensitivity: "Notities en gevoeligheid",
    recommendationScore: "Aanbevelingsscore: {score}",
    playInKovaaks: "Afspelen in KovaaK's",
    last10Scores: "Laatste 10 scores",
  },
  card: {
    favorite: "Favoriet",
    unfavorite: "Niet meer favoriet",
  },
};
