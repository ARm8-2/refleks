import type { WelcomeMessages } from "../en/welcome";

/**
 * Traducciones al español para la pantalla de bienvenida.
 * Los nombres de producto (RefleK's, KovaaK's, Steam, FFmpeg y RefleK's
 * Index) se mantienen sin traducir.
 */
export const welcome: WelcomeMessages = {
  content: {
    titleFirstLaunch: "Te damos la bienvenida a RefleK's v{version}",
    titleUpgrade: "Te damos la bienvenida de nuevo a RefleK's v{version}",
    introFirstLaunch:
      "Gracias por instalar RefleK's. Consulta el registro de cambios y la documentación para conocer las últimas funciones y mejoras.",
    introUpgrade:
      "Te damos la bienvenida de nuevo. Consulta el registro de cambios para descubrir las novedades de esta versión.",
    details:
      "Para obtener información detallada sobre los cambios, las funciones y las mejoras, visita el registro de cambios enlazado abajo. Siempre se mantiene actualizado con las notas de la versión más reciente.",
    highlightsTitle: "Primeros pasos",
    highlights: {
      changelog:
        "Visita el registro de cambios para consultar información detallada de la versión y actualizaciones de funciones.",
      docs: "Consulta la documentación para ver guías, instrucciones paso a paso y soluciones de problemas.",
      customize:
        "Personaliza tus preferencias en Ajustes para adaptar RefleK's a tus necesidades.",
      community: "Únete a la comunidad y comparte tu experiencia.",
    },
    linksTitle: "Recursos",
    ctaFirstLaunch: "Empezar a explorar",
    ctaUpgrade: "Volver a entrar",
    links: {
      docsLabel: "Explorar la documentación",
      docsDescription:
        "Guías de configuración, instrucciones paso a paso y soluciones de problemas para RefleK's.",
      changelogLabel: "Leer el registro de cambios",
      changelogDescription:
        "Consulta en el navegador el historial completo de versiones y las notas de cada versión.",
    },
  },
  modal: {
    syncStatusEnabled:
      "La sincronización de partidas está activada. Puedes cambiarlo más adelante en los ajustes de privacidad.",
    syncStatusDisabled:
      "La sincronización de partidas está desactivada en Ajustes. Si la activas más adelante, se usará esta elección.",
    sectionFirstTime: "Configuración inicial",
    sectionProfile: "Ajustes del perfil",
    sectionReview: "Ajustes",
    sectionFirstTimeDescription:
      "Elige cómo quieres comenzar a subir partidas y registrar movimientos del ratón. Puedes cambiar estas opciones más adelante en Ajustes.",
    sectionProfileDescription:
      "Elige cómo quieres que aparezcan tus partidas en RefleK's Index. Puedes cambiarlo más adelante en los ajustes de privacidad.",
    sectionReviewDescription:
      "Revisa tus ajustes actuales. Puedes cambiarlos en cualquier momento desde el panel de Ajustes.",
    recommended: "Recomendado",
    later: "Más tarde",
    private: "Privado",
    index: {
      label: "RefleK's Index",
      description:
        "Las partidas completadas se pueden subir a RefleK's Index, un conjunto de datos compartido que alimenta las clasificaciones, las comparaciones y la investigación de la comunidad mundial de jugadores.",
    },
    publicProfile: {
      label: "Perfil público",
      subtitle: "Mostrar mi nombre de Steam en RefleK's Index.",
      description:
        "La mejor opción si quieres que tu nombre de Steam aparezca junto a las partidas que subas.",
      bullets: [
        "Tu nombre de Steam aparecerá en las partidas que subas a RefleK's Index.",
        "Puedes cambiar a Anónimo más adelante en los ajustes de privacidad.",
      ],
    },
    anonymous: {
      label: "Anónimo",
      subtitle: "Identidad privada, contribución compartida.",
      description:
        "La mejor opción si quieres contribuir con datos sin incluir información identificativa en las subidas.",
      bullets: [
        "El Steam ID y el nombre de perfil se eliminan antes de subir los datos.",
        "Tus partidas seguirán ayudando al conjunto de datos compartido, al análisis y a la investigación.",
        "Puedes volver a cambiar a Público más adelante en los ajustes de privacidad.",
      ],
    },
    mouseTraces: {
      label: "Trazas del ratón",
      description:
        "Las trazas del ratón registran tus movimientos durante las partidas para que puedas reproducirlos y compararlos más adelante. El registro está diseñado para no afectar al rendimiento durante la partida.",
      helper:
        "Este es solo tu punto de partida: puedes cambiarlo más adelante en los ajustes generales.",
      enabled: {
        label: "Activar trazas del ratón",
        subtitle: "Registrar el movimiento durante las partidas compatibles.",
        description:
          "La mejor opción si quieres un historial más completo y herramientas de repetición desde tu primera sesión.",
        bullets: [
          "No afecta al rendimiento durante la partida.",
          "Te permite reproducir y comparar partidas en la vista Historial.",
          "Se puede desactivar en cualquier momento en los ajustes generales.",
        ],
      },
      disabled: {
        label: "Ahora no",
        subtitle: "Empieza sin registrar trazas y actívalo cuando quieras.",
        description:
          "Un buen punto de partida si primero quieres familiarizarte con la aplicación y decidir después de unas sesiones si quieres usar trazas.",
        bullets: [
          "Mantiene sencilla la configuración inicial.",
          "Puedes activar las trazas más adelante en los ajustes generales.",
          "El resto de la aplicación funciona igual en ambos casos.",
        ],
      },
    },
    screenReplay: {
      label: "Repetición de pantalla",
      description:
        "Graba una repetición en vídeo de tus partidas para que puedas volver a ver y analizar la colocación de la mira, el movimiento y la toma de decisiones directamente en la aplicación.",
      helper:
        "Requiere FFmpeg. Puedes cambiarlo más adelante en los ajustes generales.",
      enabled: {
        label: "Activar la grabación de repeticiones",
        subtitle:
          "Capturar la pantalla durante las partidas (aceleración por hardware).",
        description:
          "La mejor opción si quieres revisar visualmente tu juego junto con tus estadísticas y la traza del ratón.",
        bullets: [
          "Graba a 30 fps con codificación mediante la GPU: impacto nulo en la CPU.",
          "Las repeticiones aparecen como una pestaña nueva en el inspector de partidas después de cada partida.",
          "Se puede desactivar en cualquier momento en los ajustes generales.",
        ],
      },
      disabled: {
        label: "Empezar sin grabar",
        subtitle:
          "Empieza solo con el seguimiento del ratón y añade repeticiones de pantalla cuando quieras.",
        description:
          "Un punto de partida sencillo. Puedes activar la grabación de repeticiones más adelante, cuando te sientas cómodo con la aplicación.",
        bullets: [
          "Mantiene sencilla la configuración inicial.",
          "Las trazas del ratón y todas las demás funciones seguirán funcionando.",
          "Puedes activar la captura de pantalla en cualquier momento desde los ajustes generales.",
        ],
      },
    },
    resourcesDescription:
      "Si quieres conocer toda la evolución de la versión, el registro de cambios y la documentación están siempre a un clic.",
  },
};
