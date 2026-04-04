import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DIFF_ICONS = { fácil: '🌊', normal: '⚔️', difícil: '💀' }

// Overlay de selección de historia + dificultad para continuar una aventura inline
// sin salir de GameRoom. Llama a onConfirm(story, template) al confirmar.
export default function ContinuePicker({ onConfirm, onCancel }) {
  const [step, setStep] = useState('story') // 'story' | 'difficulty' | 'loading'
  const [stories, setStories] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedStory, setSelectedStory] = useState(null)

  useEffect(() => {
    supabase.from('stories').select('id, title, description, estimated_minutes, is_custom')
      .order('is_custom').order('title')
      .then(({ data }) => { if (data) setStories(data) })
    supabase.from('difficulty_templates').select('*').order('event_count')
      .then(({ data }) => { if (data) setTemplates(data) })
  }, [])

  async function handleDifficultySelect(template) {
    setStep('loading')
    await onConfirm(selectedStory, template)
    // El componente se desmontará cuando la sesión cambie
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8">
      <div className="mx-4 max-w-lg w-full rounded-2xl border border-gold/40 bg-canvas p-8 flex flex-col gap-6 shadow-2xl shadow-gold/20">

        {/* Banner de tripulación */}
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-5 py-3 text-sm text-gold-bright flex items-center gap-2">
          <span>⚔️</span>
          <span>Continuando con la misma tripulación — el inventario, XP y berries se conservan.</span>
        </div>

        {step === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-5xl animate-pulse">🎬</div>
            <p className="text-sm font-bold text-gold-bright">El Director está preparando la aventura…</p>
          </div>
        ) : step === 'story' ? (
          <>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-gold-dim/60 mb-1">Nueva aventura</p>
              <h2 className="text-xl font-bold text-gold-bright" style={{ fontFamily: 'var(--font-display)' }}>Elige una historia</h2>
            </div>

            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {stories.map(story => (
                <button
                  key={story.id}
                  onClick={() => { setSelectedStory(story); setStep('difficulty') }}
                  className="w-full text-left rounded-xl border border-stroke bg-panel px-5 py-4 hover:border-gold/40 hover:bg-raised/60 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink group-hover:text-gold-bright transition-colors">{story.title}</p>
                      <p className="text-xs text-ink-3 mt-0.5">{story.description}</p>
                    </div>
                    {story.estimated_minutes && (
                      <span className="text-xs text-ink-off shrink-0">~{story.estimated_minutes} min</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={onCancel}
              className="w-full py-2.5 rounded-xl font-semibold border border-stroke text-ink-2 hover:bg-raised/50 transition-all text-sm"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-gold-dim/60 mb-1">Dificultad</p>
              <h2 className="text-xl font-bold text-gold-bright">{selectedStory?.title}</h2>
            </div>

            <div className="flex flex-col gap-3">
              {templates.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => handleDifficultySelect(tmpl)}
                  className="w-full text-left rounded-xl border border-stroke bg-panel px-5 py-4 hover:border-gold/40 hover:bg-raised/60 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xl">{DIFF_ICONS[tmpl.name] || '⚔️'}</span>
                    <span className="text-base font-bold text-ink capitalize group-hover:text-gold-bright transition-colors">{tmpl.name}</span>
                    <span className="text-xs text-ink-off border border-stroke-3 rounded px-2 py-0.5">{tmpl.event_count} eventos</span>
                  </div>
                  <p className="text-sm text-ink-3 ml-9">{tmpl.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('story')}
              className="w-full py-2.5 rounded-xl font-semibold border border-stroke text-ink-2 hover:bg-raised/50 transition-all text-sm"
            >
              ← Volver a historias
            </button>
          </>
        )}
      </div>
    </div>
  )
}
