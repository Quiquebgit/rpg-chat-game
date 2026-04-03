import { useEffect, useRef } from 'react'

const DEFAULT_TITLE = '\u2693 Grand Line'
const TURN_TITLE = '\u2694\uFE0F \u00A1Tu turno! \u2014 Grand Line'

// Alterna el t\u00edtulo de la pesta\u00f1a cuando es el turno del jugador y la pesta\u00f1a est\u00e1 oculta.
// Al volver al foco o cambiar de turno, restaura el t\u00edtulo por defecto.
export function useTurnNotification(isMyTurn) {
  const intervalRef = useRef(null)

  useEffect(() => {
    // Siempre establecer el t\u00edtulo base al montar
    document.title = DEFAULT_TITLE

    function handleVisibility() {
      if (document.hidden && isMyTurn) {
        startFlashing()
      } else {
        stopFlashing()
      }
    }

    function startFlashing() {
      stopFlashing()
      // Alternar t\u00edtulo cada 2s para llamar la atenci\u00f3n
      let show = true
      document.title = TURN_TITLE
      intervalRef.current = setInterval(() => {
        document.title = show ? DEFAULT_TITLE : TURN_TITLE
        show = !show
      }, 2000)
    }

    function stopFlashing() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.title = DEFAULT_TITLE
    }

    // Si es mi turno y la tab ya est\u00e1 oculta, empezar a parpadear
    if (document.hidden && isMyTurn) {
      startFlashing()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      stopFlashing()
    }
  }, [isMyTurn])
}
