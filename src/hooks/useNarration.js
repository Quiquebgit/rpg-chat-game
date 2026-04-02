import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'rpg_narration_enabled'
const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

// Limpia el texto antes de enviarlo a síntesis de voz
function cleanText(text) {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '') // emojis
    .replace(/#{1,6}\s?/g, '')                  // markdown headers
    .replace(/\*{1,3}|_{1,3}|`{1,3}/g, '')     // negrita, cursiva, código
    .replace(/\s+/g, ' ')
    .trim()
}

export function useNarration() {
  const googleTtsKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY
  const useGoogleTts = !!googleTtsKey

  const supported = useGoogleTts || (typeof window !== 'undefined' && 'speechSynthesis' in window)
  const [isEnabled, setIsEnabled] = useState(() => {
    if (!supported) return false
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  })
  const [isNarrating, setIsNarrating] = useState(false)
  const [error, setError] = useState(null)
  const voiceRef = useRef(null)
  const audioRef = useRef(null) // elemento Audio activo para Google TTS

  // Seleccionar la mejor voz española disponible (se carga asíncrono en algunos navegadores)
  useEffect(() => {
    if (useGoogleTts || !supported) return
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
  }, [supported, useGoogleTts])

  function cancelCurrentAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  async function speakGoogleTts(text) {
    const clean = cleanText(text)
    if (!clean) return

    // Cancelar audio anterior antes de empezar uno nuevo
    cancelCurrentAudio()

    setIsNarrating(true)
    setError(null)

    try {
      const response = await fetch(`${GOOGLE_TTS_URL}?key=${googleTtsKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: clean },
          voice: { languageCode: 'es-ES', name: 'es-ES-Neural2-B' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.15, pitch: -4.0, volumeGainDb: 2.0 },
        }),
      })

      if (!response.ok) {
        const msg = await response.text()
        throw new Error(`Google TTS ${response.status}: ${msg}`)
      }

      const { audioContent } = await response.json()
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`)
      audioRef.current = audio

      audio.onended = () => {
        audioRef.current = null
        setIsNarrating(false)
      }
      audio.onerror = () => {
        audioRef.current = null
        setIsNarrating(false)
        setError('Error al reproducir el audio de narración.')
      }

      await audio.play()
    } catch (err) {
      console.warn('[narración] Google TTS error:', err)
      setIsNarrating(false)
      // Fallback a Web Speech API si Google TTS falla (ej. restricción de referrer en localhost)
      if ('speechSynthesis' in window) {
        speakWeb(text)
      } else {
        setError('Error al conectar con Google TTS para la narración.')
      }
    }
  }

  function speakWeb(text) {
    const synth = window.speechSynthesis
    const clean = cleanText(text)
    if (!clean) return

    // Parar narración anterior antes de empezar la nueva
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(clean)
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

  function speak(text) {
    if (!supported || !isEnabled || !text) return
    if (useGoogleTts) {
      speakGoogleTts(text)
    } else {
      speakWeb(text)
    }
  }

  function stop() {
    if (!supported) return
    if (useGoogleTts) {
      cancelCurrentAudio()
    } else {
      window.speechSynthesis.cancel()
    }
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
