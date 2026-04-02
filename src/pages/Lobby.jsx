import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { characters } from '../data/characters'
import { initializeStorySession } from '../lib/director'
import { SESSION_STATUS } from '../data/constants'

// Carga todos los ficheros .md de historias como texto plano
const STORY_FILES = import.meta.glob('../data/stories/*.md', { query: '?raw', import: 'default', eager: true })

// Parsea el frontmatter YAML simple de un fichero .md
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    result[key] = isNaN(value) || value === '' ? value : Number(value)
  }
  return result
}

// Extrae el cuerpo del .md (sin frontmatter)
function parseBody(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

// Lista de historias disponibles con su clave de fichero
const STORIES = Object.entries(STORY_FILES).map(([path, content]) => {
  const meta = parseFrontmatter(content)
  const filename = path.split('/').pop() // e.g. "porto-falcon.md"
  return { filename, content, ...meta }
}).sort((a, b) => (a.title || '').localeCompare(b.title || ''))

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Iconos ───────────────────────────────────────────────────────────────────

function IconEnter() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

function IconArchive() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

function IconRestore() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

function Lobby({ onSessionSelect }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  // Flujo de creación de aventura
  const [view, setView] = useState('sessions') // 'sessions' | 'story-picker' | 'difficulty-picker' | 'initializing'
  const [selectedStory, setSelectedStory] = useState(null)
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    loadSessions()
    loadTemplates()

    const sub = supabase
      .channel('lobby-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, loadSessions)
      .subscribe()

    return () => sub.unsubscribe()
  }, [])

  async function loadSessions() {
    const { data, error } = await supabase.from('sessions').select('*')
    if (error) { console.error('Error cargando sesiones:', error); return }
    const sorted = (data || []).sort((a, b) => {
      const byActivity = new Date(b.updated_at) - new Date(a.updated_at)
      return byActivity !== 0 ? byActivity : new Date(b.created_at) - new Date(a.created_at)
    })
    setSessions(sorted)
    setLoading(false)
  }

  async function loadTemplates() {
    const { data } = await supabase.from('difficulty_templates').select('*').order('event_count')
    if (data) setTemplates(data)
  }

  // ─── Crear sesión con historia ───────────────────────────────────────────

  async function handleStartAdventure(template) {
    setView('initializing')
    const story = selectedStory
    const turnOrder = characters.map(c => c.id)

    // 1. Crear la sesión con story_file y difficulty_template_id
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        turn_order: turnOrder,
        current_turn_character_id: turnOrder[0],
        story_file: story.filename,
        difficulty_template_id: template.id,
        current_event_order: 1,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando sesión:', error)
      setView('difficulty-picker')
      return
    }

    // 2. Inicializar estados de personajes
    await supabase.from('session_character_state').insert(
      characters.map(c => ({ session_id: newSession.id, character_id: c.id, hp_current: c.hp, inventory: [] }))
    )

    // 3. Llamar al Director para planificar el primer evento
    const storyBody = parseBody(story.content)
    await initializeStorySession(newSession.id, storyBody, template)

    // 4. Recargar la sesión (con story_lore y current_event_briefing ya guardados)
    const { data: readySession } = await supabase
      .from('sessions').select('*').eq('id', newSession.id).single()

    setView('sessions')
    setSelectedStory(null)
    onSessionSelect(readySession || newSession)
  }

  // ─── Gestión de sesiones existentes ──────────────────────────────────────

  async function handleArchive(sessionId) {
    setBusy(sessionId)
    await supabase.from('sessions').update({ status: 'abandoned' }).eq('id', sessionId)
    setBusy(null)
  }

  async function handleRestore(sessionId) {
    setBusy(sessionId)
    await supabase.from('sessions').update({ status: 'active' }).eq('id', sessionId)
    setBusy(null)
  }

  async function handleDelete(sessionId) {
    if (!confirm('¿Borrar esta sesión y todos sus mensajes? Esta acción no se puede deshacer.')) return
    setBusy(sessionId)
    await supabase.from('messages').delete().eq('session_id', sessionId)
    await supabase.from('session_character_state').delete().eq('session_id', sessionId)
    await supabase.from('sessions').delete().eq('id', sessionId)
    setBusy(null)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  // Pantalla de inicialización del Director
  if (view === 'initializing') {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center gap-6 px-6"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,10,60,0.95), transparent 60%), #030712' }}
      >
        <div className="text-5xl animate-pulse">🎬</div>
        <h2 className="text-xl font-bold text-amber-300">El Director está preparando la aventura…</h2>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Adaptando la historia al nivel de dificultad elegido. Esto puede tardar unos segundos.
        </p>
      </div>
    )
  }

  // Selector de dificultad
  if (view === 'difficulty-picker' && selectedStory) {
    const DIFF_ICONS = { fácil: '🌊', normal: '⚔️', difícil: '💀' }
    return (
      <div className="min-h-screen text-white px-6 py-10"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,10,60,0.95), transparent 60%), #030712' }}
      >
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('story-picker')} className="text-xs text-gray-600 hover:text-gray-400 mb-8 flex items-center gap-1">
            ← Volver a historias
          </button>
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-widest text-amber-500/60 mb-2">Dificultad</p>
            <h2 className="text-2xl font-bold text-amber-300">{selectedStory.title}</h2>
          </div>
          <div className="flex flex-col gap-4">
            {templates.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => handleStartAdventure(tmpl)}
                className="w-full text-left rounded-xl border border-gray-800 bg-gray-900 px-6 py-5 hover:border-amber-400/40 hover:bg-gray-800/60 transition-all group"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{DIFF_ICONS[tmpl.name] || '⚔️'}</span>
                  <span className="text-lg font-bold text-gray-100 capitalize group-hover:text-amber-300 transition-colors">{tmpl.name}</span>
                  <span className="text-xs text-gray-600 border border-gray-700 rounded px-2 py-0.5">{tmpl.event_count} eventos</span>
                </div>
                <p className="text-sm text-gray-500 ml-11">{tmpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Selector de historia
  if (view === 'story-picker') {
    return (
      <div className="min-h-screen text-white px-6 py-10"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,10,60,0.95), transparent 60%), #030712' }}
      >
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('sessions')} className="text-xs text-gray-600 hover:text-gray-400 mb-8 flex items-center gap-1">
            ← Volver al lobby
          </button>
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-widest text-amber-500/60 mb-2">Nueva aventura</p>
            <h2 className="text-2xl font-bold text-amber-300" style={{ fontFamily: 'var(--font-display)' }}>Elige una historia</h2>
          </div>
          <div className="flex flex-col gap-4">
            {STORIES.map(story => (
              <button
                key={story.filename}
                onClick={() => { setSelectedStory(story); setView('difficulty-picker') }}
                className="w-full text-left rounded-xl border border-gray-800 bg-gray-900 px-6 py-5 hover:border-amber-400/40 hover:bg-gray-800/60 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-100 group-hover:text-amber-300 transition-colors mb-1">{story.title}</h3>
                    <p className="text-sm text-gray-500">{story.description}</p>
                  </div>
                  {story.estimated_minutes && (
                    <span className="text-xs text-gray-600 shrink-0 mt-0.5">~{story.estimated_minutes} min</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Vista principal: lista de sesiones
  return (
    <div
      className="min-h-screen text-white px-6 py-10"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,10,60,0.95), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(0,20,80,0.5), transparent 50%), #030712' }}
    >
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-12">
          <div className="inline-block border-b border-amber-400/20 pb-6 mb-2 w-full">
            <h1
              className="text-5xl font-bold text-amber-300 tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 40px rgba(251,191,36,0.2)' }}
            >
              ⚓ Grand Line
            </h1>
            <p className="text-gray-500 text-sm italic">Elige una aventura o empieza una nueva</p>
          </div>
        </div>

        <button
          onClick={() => setView('story-picker')}
          className="w-full mb-8 py-4 rounded-xl font-bold text-lg bg-amber-400 text-gray-900 hover:bg-amber-300 hover:scale-[1.02] transition-all shadow-lg shadow-amber-400/20"
        >
          + Nueva aventura
        </button>

        {loading ? (
          <p className="text-center text-gray-600 animate-pulse text-sm">Cargando sesiones…</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-gray-700 italic text-sm mt-8">No hay sesiones todavía.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(session => {
              const status = SESSION_STATUS[session.status] || SESSION_STATUS.abandoned
              const isActive = session.status === 'active'
              const isBusy = busy === session.id
              const storyTitle = session.story_file
                ? STORIES.find(s => s.filename === session.story_file)?.title
                : null

              return (
                <div
                  key={session.id}
                  onClick={() => !isBusy && onSessionSelect(session)}
                  className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${status.style}`}>
                          {status.label}
                        </span>
                        {storyTitle && (
                          <span className="text-xs text-amber-400/70 truncate">📖 {storyTitle}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-gray-600">
                          Inicio: <span className="text-gray-400">{formatDate(session.created_at)}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          Última actividad: <span className="text-gray-400">{formatDate(session.updated_at)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 divide-x divide-gray-800" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onSessionSelect(session)} disabled={isBusy} title="Entrar"
                        className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 disabled:opacity-40 transition-colors">
                        <IconEnter />
                      </button>
                      {isActive ? (
                        <button onClick={() => handleArchive(session.id)} disabled={isBusy} title="Archivar"
                          className="p-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-700/50 disabled:opacity-40 transition-colors">
                          <IconArchive />
                        </button>
                      ) : (
                        <button onClick={() => handleRestore(session.id)} disabled={isBusy} title="Restaurar"
                          className="p-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-700/50 disabled:opacity-40 transition-colors">
                          <IconRestore />
                        </button>
                      )}
                      <button onClick={() => handleDelete(session.id)} disabled={isBusy} title="Borrar"
                        className="p-2 pl-3 rounded-lg text-red-900 hover:text-red-500 hover:bg-red-900/20 disabled:opacity-40 transition-colors">
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export default Lobby
