import type { BenchmarksMessages } from "../en/benchmarks";

/**
 * Traducciones al español para la función de benchmarks. Los nombres de
 * benchmarks, escenarios, categorías, grupos y rangos son datos del juego y
 * se mantienen sin traducir; solo se traducen las etiquetas de la interfaz.
 */
export const benchmarks: BenchmarksMessages = {
  explore: {
    title: "Benchmarks",
    sort: "Ordenar",
    group: "Agrupar",
    random: "Aleatorio",
    randomTitle: "Abrir un benchmark aleatorio",
    showAll: "Mostrar todos los benchmarks",
    showFavoritesOnly: "Mostrar solo favoritos",
    favorites: "Favoritos",
    recommended: "Recomendados",
    hideRecommendations: "Ocultar recomendaciones",
    showRecommended: "Mostrar benchmarks recomendados",
    loadingRecommendations:
      "Cargando el progreso de los benchmarks para las recomendaciones...",
    emptySyncing: "Esperando a que termine de sincronizarse el catálogo de benchmarks...",
    emptyFavorites:
      "Aún no hay benchmarks favoritos. Marca un benchmark para añadirlo aquí.",
    emptySearch: "Ningún benchmark coincide con tu búsqueda.",
    emptyAll: "No se han encontrado benchmarks.",
    sortOptions: {
      name: "Nombre",
      abbreviation: "Abreviatura",
      dateAdded: "Fecha de adición",
    },
    groupOptions: {
      abbreviation: "Abreviatura",
      category: "Categoría",
    },
    categories: {
      aim: "Grupos de aim",
      community: "Benchmarks de la comunidad",
      notable: "Benchmarks de creadores destacados",
      other: "Otros",
    },
  },
  detail: {
    difficulty: "Dificultad",
    playPlaylist: "Reproducir la lista del benchmark en KovaaK's",
    copied: "¡Copiado!",
    copyScreenshot: "Copiar captura de pantalla de la tabla de progreso",
    favorite: "Añadir benchmark a favoritos",
    unfavorite: "Quitar benchmark de favoritos",
    notFound: "No se ha encontrado el benchmark.",
    unknownDifficulty: "Dificultad desconocida",
    noProgress: "Aún no hay datos de progreso para esta dificultad.",
    clipboardUnsupported:
      "El portapapeles de imágenes no es compatible con este entorno.",
    copyFailed: "No se pudo copiar la captura de pantalla.",
  },
  progressTable: {
    title: "Seguimiento del progreso",
    snapshot: "Resumen del progreso del benchmark",
    compact: "Compacto",
    enableCompact: "Activar el modo compacto",
    disableCompact: "Desactivar el modo compacto",
    lastPlayed: "Última partida",
    showLastPlayed: "Mostrar resaltado de la última partida",
    hideLastPlayed: "Ocultar resaltado de la última partida",
    viewSettings: "Ver ajustes del seguimiento",
    columnScenario: "Escenario",
    columnRec: "Rec.",
    columnScore: "Puntuación",
    details: "Detalles",
    settingsTitle: "Ajustes del seguimiento",
    featureColumns: "Columnas de funciones",
    columnLabelNotes: "Notas",
    columnLabelRecommendations: "Recomendaciones",
    columnLabelPlay: "Jugar",
    columnLabelHistory: "Historial",
    rankVisibility: "Visibilidad de rangos",
    autoHideCleared: "Ocultar automáticamente los rangos superados anteriormente",
    keepVisible: "Mantener visibles:",
    resetManual: "Restablecer manualmente",
    hiddenAutoTitle:
      "Oculto automáticamente porque todos los escenarios ya han superado este rango",
  },
  rankDistribution: {
    title: "Distribución de rangos",
    scopeCategory: "Categoría",
    scopeSubcategory: "Subcategoría",
    descriptionAll: "Cómo se distribuyen tus escenarios entre los niveles de rango.",
    descriptionCategory: "Ámbito de categoría: {name}",
    descriptionSubcategory: "Ámbito de subcategoría: {name}",
    groupFallback: "Grupo {number}",
    belowR1: "Por debajo de R1",
    noData: "No hay datos.",
    donutAriaLabel: "Gráfico de anillo de distribución de rangos",
    scenarios: "Escenarios",
  },
  strength: {
    title: "Desglose de nivel",
    scopeCategory: "Categoría",
    scopeSubcategory: "Subcategoría",
    scopeScenario: "Escenario",
    description: "Progreso de nivel {level} hacia el rango máximo.",
    unranked: "Sin rango",
    noData: "No hay datos.",
    avg: "Media",
  },
  recommendationInfo: {
    ariaLabel: "Acerca de las recomendaciones",
    title: "Recomendaciones",
    description:
      "Qué escenarios merece la pena jugar ahora, según tu progreso, las tendencias recientes de puntuación y cuánto hace que jugaste cada uno.",
    completed: "Completado — rango máximo alcanzado",
    topPick: "Mejor opción — ideal para jugar ahora",
    stronglyRecommended: "Muy recomendado",
    recommended: "Recomendado — por debajo de la media o mejorando",
    neutral: "Neutro",
    lowPriority: "Prioridad baja",
    avoid: "Evitar por ahora — alto nivel o tendencia descendente",
  },
  scenarioHistory: {
    title: "Historial del escenario · {scenario}",
    score: "Puntuación",
    noScores: "No se han encontrado puntuaciones.",
  },
  scenarioNotes: {
    trainingSensitivity: "Sensibilidad de entrenamiento",
    sensPlaceholder: "p. ej., 35.8 cm o 0.5",
    copySensitivity: "Copiar sensibilidad",
    notesLabel: "Notas",
    notesPlaceholder:
      "Registra tu estrategia, tus puntos débiles y tus objetivos...",
  },
  scenarioRow: {
    notesSensitivity: "Notas y sensibilidad",
    recommendationScore: "Puntuación de recomendación: {score}",
    playInKovaaks: "Jugar en KovaaK's",
    last10Scores: "Últimas 10 puntuaciones",
  },
  card: {
    favorite: "Favorito",
    unfavorite: "Quitar de favoritos",
  },
};
