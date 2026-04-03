import { useState } from 'react'

// Bot\u00f3n que copia el link de invitaci\u00f3n al portapapeles con feedback visual.
export function CopyLinkButton({ sessionId, className = '' }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}?join=${sessionId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback para navegadores sin clipboard API
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Enlace copiado' : 'Copiar enlace de invitaci\u00f3n'}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? 'bg-gold/20 text-gold-bright border border-gold/40'
          : 'bg-raised text-ink-2 border border-stroke hover:bg-float hover:text-ink'
      } ${className}`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copiado
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.12 7.48l-4.5 4.5a4.5 4.5 0 01-6.36-6.36l1.06-1.06m7.18-7.18l4.5-4.5a4.5 4.5 0 016.36 6.36l-1.06 1.06" />
          </svg>
          Invitar
        </>
      )}
    </button>
  )
}
