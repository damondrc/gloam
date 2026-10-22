/**
 * Every word Gloam says, in Spanish.
 *
 * Neutral Latin American Spanish, addressing the reader as tú. Translated for
 * what each line is for rather than word for word: a tooltip is still a
 * tooltip, and a hint under a setting still has one line to say it in.
 *
 * Its shape is `Messages`, so it cannot fall out of step with the English —
 * see `en.ts` for why the sentences with numbers in them are functions.
 */
import { en, type Messages } from "./en";

export const es: Messages = {
  /**
   * Not translated, on purpose. FOCUS, BREAK and DONE are set in the
   * widget's own type at its own size and read as marks on the sky rather
   * than as text, and the Spanish candidates were measured against the face
   * before deciding: the natural pair, ENFOQUE and DESCANSO, runs into the
   * music controls the moment they appear. The words around them — the
   * panel's durations, the screen-reader labels — are Spanish.
   */
  phase: en.phase,

  widget: {
    background:
      "Fondo del widget. Arrástralo para moverlo; doble clic para alternar el modo compacto.",
    hide: "Ocultar",
    hideTitle: "Ocultar — Gloam sigue funcionando en la bandeja",
    quit: "Salir",
    quitTitle: "Salir de Gloam",
    openSettings: "Abrir ajustes",
    closeSettings: "Cerrar ajustes",
    toUnlock: "para desbloquear",
    sessionOf: (session: number, total: number) => `Sesión ${session} de ${total}`,
  },

  timer: {
    start: "Iniciar",
    pause: "Pausar",
    startTitle: "Iniciar (Espacio)",
    pauseTitle: "Pausar (Espacio)",
    skip: "Saltar tramo",
    reset: "Reiniciar",
  },

  music: {
    previous: "Pista anterior",
    next: "Pista siguiente",
    play: "Reproducir música",
    pause: "Pausar música",
  },

  padlock: {
    lockTitle: "Bloquear y dejar pasar los clics (Ctrl+Alt+G)",
    unlockTitle: "Desbloquear (Ctrl+Alt+G)",
    lock: "Bloquear el widget",
    unlock: "Desbloquear el widget",
  },

  grip: {
    label: "Tamaño del widget",
    title: "Arrastra para cambiar el tamaño · doble clic para restablecerlo",
  },

  /**
   * "anterior" and "siguiente" do not change with gender, which is why they
   * follow the name: every control gets them right whatever it is called.
   */
  controls: {
    previousOf: (name: string) => `${name} anterior`,
    nextOf: (name: string) => `${name} siguiente`,
    decrease: (name: string) => `Reducir ${name.toLocaleLowerCase("es")}`,
    increase: (name: string) => `Aumentar ${name.toLocaleLowerCase("es")}`,
  },

  tour: {
    steps: {
      sky:
        "Gloam lleva el tiempo en una esquina de tu pantalla. El cielo es el " +
        "reloj: el sol baja mientras te concentras y la luna sale mientras descansas.",
      handles:
        "No tiene barra de título: arrástralo desde cualquier parte. La esquina " +
        "cambia su tamaño y la flecha de abajo abre los ajustes.",
      compact:
        "¿Muy grande? Un doble clic lo pliega en una sola fila: el reloj, el " +
        "botón de inicio y el candado. Pruébalo, y otro doble clic lo devuelve.",
      away:
        "¿Todavía estorba? El candado deja pasar los clics, y al cerrarlo Gloam " +
        "se guarda en la bandeja sin detener el reloj. Ctrl+Alt+G lo trae de vuelta.",
    },
    stepOf: (step: number, total: number) => `Paso ${step} de ${total}`,
    skip: "Omitir",
    previous: "Anterior",
    next: "Siguiente",
    finish: "Terminar",
  },

  panel: {
    tabs: {
      general: "General",
      ambience: "Ambiente",
      music: "Música",
      keys: "Teclas",
    },

    cycle: "Ciclo",
    pauseToEdit: "pausa para editar",
    changeRestarts: "cambiarlo reinicia el ciclo",
    focus: "Enfoque",
    break: "Descanso",
    sessions: "Sesiones",
    minutes: " min",

    startup: "Arranque",
    launchAtLogin: "Abrir al iniciar sesión",
    startsInTray: "Gloam espera en la bandeja. Ctrl+Alt+G lo muestra.",
    startsOnScreen: "Gloam se abre en pantalla: este escritorio no tiene bandeja.",

    volume: "Volumen",
    sound: "Sonido",
    sounds: {
      bowl: "Cuenco",
      bell: "Campana",
      felt: "Fieltro",
    },
    soundHints: {
      bowl: "La voz propia del widget. Cálida, y tarda en apagarse.",
      bell: "Metal, en tres notas. Difícil de pasar por alto.",
      felt: "Madera y fieltro que se desvanecen. Apenas se oye.",
    },

    backdrop: "Fondo",
    backdrops: {
      full: "Completo",
      calm: "Sereno",
      light: "Ligero",
    },
    backdropHints: {
      full: "Nubes y, de vez en cuando, una bandada.",
      calm: "Solo nubes. Nada cruza rápido.",
      light: "Un cielo plano, para un equipo modesto.",
    },

    horizon: "Horizonte",
    horizons: {
      water: "Agua",
      skyline: "Ciudad",
      ridge: "Cordillera",
    },

    folder: "Carpeta",
    choose: "Elegir…",
    noFolder: "Lo que Gloam pueda decodificar. Se lee, nunca se modifica.",
    emptyFolder: "Aquí no hay nada que reproducir, o la carpeta se movió.",
    tracks: (count: number) => (count === 1 ? "1 pista" : `${count} pistas`),
    musicVolume: "Volumen de la música",
    ducked: "Baja cuando Gloam tiene algo que decir.",
    shuffle: "Aleatorio",
    crossfade: "Fundido",

    tourAgain: "Volver a ver el recorrido",
  },

  /**
   * The space bar is the one key with a name to translate. Letters and
   * Ctrl+Alt+G are what the keys themselves say.
   */
  shortcuts: {
    toggleTimer: { keys: "Espacio", does: "Iniciar o pausar" },
    toggleCompact: { keys: "C", does: "Modo compacto" },
    togglePanel: { keys: "S", does: "Abrir ajustes" },
    scale: { keys: "+ / −", does: "Cambiar tamaño" },
    lock: { keys: "Ctrl+Alt+G", does: "Bloquear, desde cualquier lugar" },
  },

  tray: {
    show: "Mostrar Gloam",
    hide: "Ocultar Gloam",
    recover: "Restablecer posición",
    quit: "Salir",
  },
};
