import { useEffect, useRef } from 'react'

const DEFAULT_TITLE = '⚓ Grand Line'
const TURN_TITLE = '⚔️ ¡Tu turno! — Grand Line'

// Alterna el título de la pestaña y muestra notificación nativa
// cuando es el turno del jugador y la pestaña está oculta.
export function useTurnNotification(isMyTurn, characterName) {
  const intervalRef = useRef(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    document.title = DEFAULT_TITLE

    // Pedir permiso de notificaciones al primer turno
    if (isMyTurn && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    function handleVisibility() {
      if (document.hidden && isMyTurn) {
        startFlashing()
        showNotification()
      } else {
        stopFlashing()
        closeNotification()
      }
    }

    function showNotification() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      closeNotification()
      const body = characterName
        ? `${characterName}, es tu momento de actuar.`
        : 'Es tu momento de actuar.'
      notificationRef.current = new Notification('⚔️ ¡Tu turno!', {
        body,
        icon: '/icons/icon-192.png',
        tag: 'turn',
      })
      notificationRef.current.onclick = () => {
        window.focus()
        closeNotification()
      }
    }

    function closeNotification() {
      if (notificationRef.current) {
        notificationRef.current.close()
        notificationRef.current = null
      }
    }

    function startFlashing() {
      stopFlashing()
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

    if (document.hidden && isMyTurn) {
      startFlashing()
      showNotification()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      stopFlashing()
      closeNotification()
    }
  }, [isMyTurn, characterName])
}
