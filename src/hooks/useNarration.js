import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'rpg_narration_enabled'

export function useNarration() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [isEnabled, setIsEnabled] = useState(() => {
    if (!supported) return false
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  })
  const [isNarrating, setIsNarrating] = useState(false)
  const [error, setError] = useState(null)
  const voiceRef = useRef(null)

  // Seleccionar la mejor voz española disponible (se carga asíncrono en algunos navegadores)
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis

    function pickVoice() {
      const voices = synth.getVoices()
      voiceRef.current =
        voices.find(v => v.lang === 'es-ES') ||
        voices.find(v => v.lang.startsWith('es')) ||
        null
      if (voiceRef.current) {
        console.log('[narración] voz seleccionada:', voiceRef.current.name, voiceRef.current.lang)
      }
    }

    pickVoice()
    synth.addEventListener('voiceschanged', pickVoice)
    return () => synth.removeEventListener('voiceschanged', pickVoice)
  }, [supported])

  function speak(text) {
    if (!supported || !isEnabled || !text) return
    const synth = window.speechSynthesis

    // Parar narración anterior antes de empezar la nueva
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = 0.9
    utterance.pitch = 0.8  // ligeramente grave para sonar dramático
    if (voiceRef.current) utterance.voice = voiceRef.current

    utterance.onstart = () => { setIsNarrating(true); setError(null) }
    utterance.onend = () => setIsNarrating(false)
    utterance.onerror = (e) => {
      setIsNarrating(false)
      // 'interrupted' y 'canceled' son errores esperados al llamar cancel()
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('[narración] error:', e.error)
        setError('Interactúa con la página primero para activar la narración por voz.')
      }
    }

    try {
      synth.speak(utterance)
    } catch (err) {
      console.warn('[narración] excepción al narrar:', err)
      setError('La narración por voz no está disponible en este navegador.')
    }
  }

  function stop() {
    if (!supported) return
    window.speechSynthesis.cancel()
    setIsNarrating(false)
  }

  function toggle() {
    if (!supported) return
    const next = !isEnabled
    setIsEnabled(next)
    localStorage.setItem(STORAGE_KEY, String(next))
    if (!next) stop()
  }

  return { speak, stop, isNarrating, isEnabled, toggle, error, supported }
}
