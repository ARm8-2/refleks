import { plural } from "../../plural";
import type { SettingsMessages } from "../en/settings";

/**
 * Traducciones al español para la configuración.
 */
export const settings: SettingsMessages = {
  page: {
    title: "Ajustes",
    description:
      "Comportamiento general, privacidad, apariencia y opciones avanzadas de integración.",
    loading: "Cargando ajustes...",
  },
  updates: {
    title: "Actualizaciones",
    description:
      "Comprueba la versión más reciente, vuelve a abrir la pantalla de bienvenida y consulta la versión actual.",
    currentVersion: "Versión actual:",
    checkForUpdates: "Buscar actualizaciones",
    readWelcomeAgain: "Volver a leer la bienvenida",
    failedToCheck: "No se pudieron comprobar las actualizaciones",
    upToDate: "¡Tienes la última versión!",
    versionAvailable: "Versión {version} disponible",
    installBannerPrefix: "Tienes la versión {version}. Haz clic",
    installBannerSuffix:
      "para descargarla en segundo plano; la aplicación se cerrará y el instalador se abrirá automáticamente.",
    downloading: "Descargando...",
    installUpdate: "Instalar actualización",
    viewChangelog: "Ver el registro de cambios",
    failedToDownload: "No se pudo descargar la actualización",
  },
  general: {
    title: "General",
    description: "Carpetas principales y comportamiento de las sesiones.",
    kovaaksInstallFolder: "Carpeta de instalación de KovaaK's",
    kovaaksInstallFolderDescription:
      "Ruta a la carpeta de instalación de KovaaK's, usada para localizar FPSAimTrainer/stats y FPSAimTrainer/performances",
    startWithKovaaks: "Iniciar con KovaaK's",
    startWithKovaaksDescription:
      "Inicia RefleK's automáticamente al iniciar KovaaK's; RefleK's también se iniciará con Windows",
    mouseTracking: "Seguimiento del ratón",
    mouseTrackingDescription:
      "Graba el movimiento del ratón durante los escenarios (solo Windows)",
    bufferDuration: "Duración del búfer",
    bufferDurationDescription:
      "Minutos de datos del ratón que se conservan en memoria",
    screenCapture: "Captura de pantalla",
    screenCaptureDescription:
      "Graba la pantalla durante los escenarios para crear repeticiones de vídeo (solo Windows, requiere FFmpeg)",
    screenCaptureStatusActive: "Captura de pantalla activa",
    screenCaptureStatusError: "Error de captura de pantalla",
    screenCaptureStatusUnavailable: "Captura de pantalla no disponible",
    screenCaptureStatusReady: "Captura de pantalla lista",
    screenCaptureEncoder: "Usando {encoder}",
    screenCaptureHardware: " (aceleración por hardware)",
    screenCaptureSoftware: " (software)",
    ffmpegMissingTitle: "No se detectó FFmpeg",
    ffmpegMissingPrefix: "Coloca",
    ffmpegMissingSuffix: "junto a",
    resolution: "Resolución",
    resolutionDescription:
      "Resolución usada para las nuevas sesiones de captura; cambiarla mientras el juego está en ejecución rota la sesión de captura inmediatamente",
    resolutionNative: "Nativa (resolución del monitor)",
    resolution1080: "1080p (1920×1080)",
    resolution900: "900p (1600×900)",
    resolution720: "720p (1280×720)",
    captureFps: "FPS de captura",
    captureFpsDescription:
      "Fotogramas por segundo para las nuevas sesiones de captura; cambiarlo mientras el juego está en ejecución rota la sesión de captura inmediatamente",
    replayCleanup: "Limpieza de repeticiones",
    replayCleanupDescription:
      "Elimina automáticamente las repeticiones antiguas y limita el almacenamiento; se ejecuta al iniciar y después de crear nuevas repeticiones",
    replayAgeLimit: "Límite de antigüedad de las repeticiones",
    replayAgeLimitDescription:
      "Elimina las repeticiones más antiguas que este límite; Ilimitado desactiva el límite de antigüedad",
    replayAge1d: "1 día",
    replayAge2d: "2 días",
    replayAge4d: "4 días",
    replayAge1w: "1 semana",
    replayAge2w: "2 semanas",
    replayAge1m: "1 mes",
    storageLimit: "Límite de almacenamiento",
    storageLimitDescription:
      "Elimina las repeticiones más antiguas cuando la carpeta de repeticiones supera este tamaño; Ilimitado desactiva el límite de almacenamiento",
    storage1gb: "1 GB",
    storage2gb: "2 GB",
    storage5gb: "5 GB",
    storage10gb: "10 GB",
    storage25gb: "25 GB",
    sessionGap: "Intervalo entre sesiones",
    sessionGapDescription:
      "Minutos de inactividad antes de iniciar una nueva sesión",
    sessionGapMinutes: plural({ one: "1 minuto", other: "{count} minutos" }),
  },
  privacy: {
    title: "Privacidad",
    description:
      "Controla si las partidas se suben y si los datos identificativos del entorno se eliminan antes de sincronizar.",
    runSync: "Sincronización de partidas",
    runSyncDescription: "Sube las partidas completadas a RefleK's Index.",
    anonymousMode: "Modo anónimo",
    anonymousModeDescription:
      "Elimina el Steam ID y el nombre de perfil de Steam de los datos del entorno de la partida antes de subirlos mediante la sincronización.",
  },
  appearance: {
    title: "Apariencia",
    description: "Preferencias visuales de la interfaz.",
    theme: "Tema",
    themeDescription: "Tema de color de la aplicación",
    themeDark: "Oscuro",
    themeDarker: "Más oscuro",
    themeLight: "Claro",
    themeCustom: "Personalizado",
    themeCustomDescription:
      "Personaliza por completo los colores, las fuentes y mucho más editando el archivo de tema personalizado en la carpeta de configuración de RefleK's. Los cambios se aplican después de reiniciar.",
    openThemeFile: "Abrir archivo de tema",
    regenerateThemeFile: "Regenerar",
    themeFileRegenerateConfirm:
      "¿Regenerar el archivo de tema? Tus personalizaciones se reemplazarán por los valores predeterminados.",
    themeFileWriteFailed:
      "No se pudo escribir el archivo de tema personalizado.",
    themeFileOpenFailed: "No se pudo abrir el archivo de tema personalizado.",
    font: "Fuente",
    fontDescription: "Familia tipográfica de la interfaz",
    scale: "Escala",
    scaleDescription:
      "Tamaño de la interfaz; los valores más pequeños permiten mostrar más contenido en pantallas grandes",
    language: "Idioma",
    languageDescription: "Idioma de la interfaz de la aplicación",
  },
  advanced: {
    title: "Avanzado",
    description: "Opciones de integración y conservación de datos.",
    show: "Mostrar ajustes avanzados",
    hide: "Ocultar ajustes avanzados",
    steam: "Steam",
    steamInstallDirectory: "Directorio de instalación de Steam",
    steamId: "Steam ID",
    steamIdDescription:
      "Detectado automáticamente desde la cuenta de Steam con sesión iniciada.",
    personaName: "Nombre de perfil",
    personaNameDescription:
      "Detectado automáticamente desde la cuenta de Steam con sesión iniciada.",
    displayNamePlaceholder: "Nombre para mostrar",
    dataRetention: "Conservación de datos",
    recentRunsWindow: "Periodo de partidas recientes (días)",
    recentRunsWindowDescription:
      "Solo se cargan y muestran las partidas de los últimos N días",
    recentRunsMinCount: "Cantidad mínima de partidas recientes",
    recentRunsMinCountDescription:
      "Si el periodo de días contiene muy pocas partidas, incluye partidas anteriores hasta alcanzar este mínimo",
  },
  footer: {
    clearCache: "Borrar caché",
    saving: "Guardando ajustes...",
    unsavedChanges: "Cambios sin guardar",
    allSaved: "Todos los cambios se han guardado",
    quitApp: "Salir de la aplicación",
  },
  errors: {
    failedToSaveSettings: "No se pudieron guardar los ajustes",
    failedToUpdateAutostart:
      "No se pudo actualizar el inicio automático: {message}",
  },
  clearCache: {
    title: "Borrar caché",
    description:
      "Esto borrará todos los datos en caché, incluidas las estadísticas procesadas y las clasificaciones calculadas. Tus ajustes y datos de sesión no se verán afectados.",
    clearing: "Borrando...",
  },
  resetSettings: {
    title: "Restablecer ajustes",
    description:
      "Selecciona los datos que quieres restablecer a sus valores predeterminados:",
    settingsAndConfig: "Ajustes y configuración",
    favoriteScenarios: "Escenarios favoritos",
    scenarioNotes: "Notas de escenarios",
    sessionNotes: "Notas de sesión",
    resetting: "Restableciendo...",
    resetSelected: "Restablecer seleccionados",
  },
};
