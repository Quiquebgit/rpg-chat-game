import { useState, useEffect } from 'react'

const STORAGE_KEY = 'op-family-mode'

// Modo familia: simplifica la UI ocultando opciones avanzadas.
// Persiste en localStorage y setea data-family en <html>.
export function useFamilyMode() {
  const [familyMode, setFamilyMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, familyMode)
    if (familyMode) {
      document.documentElement.setAttribute('data-family', 'true')
    } else {
      document.documentElement.removeAttribute('data-family')
    }
  }, [familyMode])

  function toggleFamilyMode() {
    setFamilyMode(v => !v)
  }

  return { familyMode, toggleFamilyMode }
}
