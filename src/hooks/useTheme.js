import { useState, useEffect } from 'react'

const STORAGE_KEY = 'op-theme'

// Devuelve qué tema efectivo aplicar según preferencia guardada y sistema
function resolveTheme(saved) {
  if (saved === 'dark' || saved === 'light') return saved
  // 'system' o null → detectar preferencia del dispositivo
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useTheme() {
  const [preference, setPreference] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'system'
  })

  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    return resolveTheme(localStorage.getItem(STORAGE_KEY))
  })

  // Aplicar data-theme al <html> y sincronizar effectiveTheme
  useEffect(() => {
    const resolved = resolveTheme(preference === 'system' ? null : preference)
    document.documentElement.setAttribute('data-theme', resolved)
    setEffectiveTheme(resolved)
  }, [preference])

  // Escuchar cambios en la preferencia del sistema cuando está en modo 'system'
  useEffect(() => {
    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e) => {
      const resolved = e.matches ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', resolved)
      setEffectiveTheme(resolved)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  function setTheme(value) {
    // value: 'dark' | 'light' | 'system'
    localStorage.setItem(STORAGE_KEY, value)
    setPreference(value)
  }

  function toggleTheme() {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
  }

  return { preference, effectiveTheme, setTheme, toggleTheme }
}
