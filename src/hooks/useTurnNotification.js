import { useEffect, useRef } from 'react'

const DEFAULT_TITLE = '⚓ Grand Line'
const TURN_TITLE = '⚔️ ¡Tu turno! — Grand Line'

// Alterna el título de la pestaña cuando es el turno del jugador y la pestaña está oculta.
// Al volver al foco o cambiar de turno, restaura el título por defecto.
export function useTurnNotification(isMyTurn) {
  const intervalRef = useRef(null)

  useEffect(() => {
    // Siempre establecer el título base al montar
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
      // Alternar título cada 2s para llamar la atención
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

    // Si es mi turno y la tab ya está oculta, empezar a parpadear
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
