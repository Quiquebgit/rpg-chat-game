import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { characters } from '../data/characters'
import { initializeStorySession } from '../lib/director'
import { SESSION_STATUS } from '../data/constants'
import ThemeToggle from '../components/ThemeToggle'
import StoryEditor from '../components/StoryEditor'
import { CopyLinkButton } from '../components/CopyLinkButton'
import FamilyModeToggle from '../components/FamilyModeToggle'
import { SessionHistoryCard } from '../components/SessionHistoryCard'

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
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.244-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
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

function Lobby({ onSessionSelect, continueFromSession, onContinueHandled, onContinueWithCrew, familyMode, toggleFamilyMode }) {
  const [sessions, setSessions] = useState([])
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  // Flujo de creación de aventura
  const [view, setView] = useState('sessions') // 'sessions' | 'story-picker' | 'story-editor' | 'difficulty-picker' | 'initializing'
  const [selectedStory, setSelectedStory] = useState(null)
  const [editingStory, setEditingStory] = useState(null) // historia a editar (null = crear nueva)
  const [templates, setTemplates] = useState([])

  // Pestaña activa: 'active' | 'finished' | 'abandoned' | 'fame'
  const [sessionTab, setSessionTab] = useState('active')

  useEffect(() => {
    loadSessions()
    loadStories()
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

  async function loadStories() {
    const { data } = await supabase.from('stories').select('id, title, description, estimated_minutes, is_custom').order('is_custom').order('title')
    if (data) setStories(data)
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

    // 1. Crear la sesión con story_id y difficulty_template_id
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        turn_order: turnOrder,
        current_turn_character_id: turnOrder[0],
        story_id: story.id,
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

    // 2. Inicializar estados de personajes (preservando progresión si continuamos tripulación)
    let prevStates = []
    if (continueFromSession) {
      const { data } = await supabase
        .from('session_character_state')
        .select('character_id, inventory, money, xp, stat_upgrades')
        .eq('session_id', continueFromSession.id)
      prevStates = data || []
    }

    await supabase.from('session_character_state').insert(
      characters.map(c => {
        const prev = prevStates.find(s => s.character_id === c.id)
        return {
          session_id: newSession.id,
          character_id: c.id,
          hp_current: c.hp, // siempre descansados al empezar aventura nueva
          inventory: prev?.inventory || [],
          money: prev?.money || 0,
          xp: prev?.xp || 0,
          stat_upgrades: prev?.stat_upgrades || {},
        }
      })
    )

    // 3. Llamar al Director para planificar el primer evento (carga lore desde BD)
    await initializeStorySession(newSession.id, story.id, template)

    // 4. Recargar la sesión (con story_lore y current_event_briefing ya guardados)
    const { data: readySession } = await supabase
      .from('sessions').select('*').eq('id', newSession.id).single()

    setView('sessions')
    setSelectedStory(null)
    if (continueFromSession) onContinueHandled()
    onSessionSelect(readySession || newSession)
  }

  // ─── Gestión de historias ─────────────────────────────────────────────────

  function handleCreateStory() {
    setEditingStory(null)
    setView('story-editor')
  }

  function handleEditStory(story, e) {
    e.stopPropagation()
    setEditingStory(story)
    setView('story-editor')
  }

  async function handleDeleteStory(story, e) {
    e.stopPropagation()
    if (!confirm(`¿Borrar la historia "${story.title}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('stories').delete().eq('id', story.id)
    loadStories()
  }

  function handleStorySaved() {
    loadStories()
    setView('story-picker')
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

  // Obtiene el título de la historia de una sesión
  function getStoryTitle(session) {
    if (session.story_id) {
      return stories.find(s => s.id === session.story_id)?.title || null
    }
    return null
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  // Pantalla de inicialización del Director
  if (view === 'initializing') {
    return (
      <div className="min-h-screen text-ink flex flex-col items-center justify-center gap-6 px-6"
        style={{ background: 'var(--gradient-lobby)' }}
      >
        <div className="text-5xl animate-pulse">🎬</div>
        <h2 className="text-xl font-bold text-gold-bright">El Director está preparando la aventura…</h2>
        <p className="text-sm text-ink-3 text-center max-w-sm">
          Adaptando la historia al nivel de dificultad elegido. Esto puede tardar unos segundos.
        </p>
      </div>
    )
  }

  // Editor de historias (crear / editar)
  if (view === 'story-editor') {
    return (
      <div className="min-h-screen text-ink px-6 py-10"
        style={{ background: 'var(--gradient-lobby)' }}
      >
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('story-picker')} className="text-xs text-ink-off hover:text-ink-2 mb-8 flex items-center gap-1">
            ← Volver a historias
          </button>
          <StoryEditor
            story={editingStory}
            onSaved={handleStorySaved}
            onCancel={() => setView('story-picker')}
          />
        </div>
      </div>
    )
  }

  // Selector de dificultad
  if (view === 'difficulty-picker' && selectedStory) {
    const DIFF_ICONS = { fácil: '🌊', normal: '⚔️', difícil: '💀' }
    return (
      <div className="min-h-screen text-ink px-6 py-10"
        style={{ background: 'var(--gradient-lobby)' }}
      >
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('story-picker')} className="text-xs text-ink-off hover:text-ink-2 mb-8 flex items-center gap-1">
            ← Volver a historias
          </button>
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-widest text-gold-dim/60 mb-2">Dificultad</p>
            <h2 className="text-2xl font-bold text-gold-bright">{selectedStory.title}</h2>
          </div>
          <div className="flex flex-col gap-4">
            {templates.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => handleStartAdventure(tmpl)}
                className="w-full text-left rounded-xl border border-stroke bg-panel px-6 py-5 hover:border-gold/40 hover:bg-raised/60 transition-all group"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{DIFF_ICONS[tmpl.name] || '⚔️'}</span>
                  <span className="text-lg font-bold text-ink capitalize group-hover:text-gold-bright transition-colors">{tmpl.name}</span>
                  <span className="text-xs text-ink-off border border-stroke-3 rounded px-2 py-0.5">{tmpl.event_count} eventos</span>
                </div>
                <p className="text-sm text-ink-3 ml-11">{tmpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Selector de historia
  if (view === 'story-picker') {
    const builtIn = stories.filter(s => !s.is_custom)
    const custom = stories.filter(s => s.is_custom)
    return (
      <div className="min-h-screen text-ink px-6 py-10"
        style={{ background: 'var(--gradient-lobby)' }}
      >
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('sessions')} className="text-xs text-ink-off hover:text-ink-2 mb-8 flex items-center gap-1">
            ← Volver al menú principal
          </button>
          {continueFromSession && (
            <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 px-5 py-3 text-sm text-gold-bright flex items-center gap-2">
              <span>⚔️</span>
              <span>Continuando con la misma tripulación — el inventario, XP y berries se conservan.</span>
            </div>
          )}

          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold-dim/60 mb-1">Nueva aventura</p>
              <h2 className="text-2xl font-bold text-gold-bright" style={{ fontFamily: 'var(--font-display)' }}>Elige una historia</h2>
            </div>
            <button
              onClick={handleCreateStory}
              className="text-sm font-semibold text-gold border border-gold/30 bg-gold/10 px-4 py-2 rounded-lg hover:bg-gold hover:text-canvas transition-all"
            >
              + Crear historia
            </button>
          </div>

          {/* Historias personalizadas primero si las hay */}
          {custom.length > 0 && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-3 mb-3">Tus historias</p>
              <div className="flex flex-col gap-3">
                {custom.map(story => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onSelect={() => { setSelectedStory(story); setView('difficulty-picker') }}
                    onEdit={(e) => handleEditStory(story, e)}
                    onDelete={(e) => handleDeleteStory(story, e)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historias predefinidas */}
          {builtIn.length > 0 && (
            <div>
              {custom.length > 0 && (
                <p className="text-xs uppercase tracking-widest text-ink-3 mb-3">Historias oficiales</p>
              )}
              <div className="flex flex-col gap-3">
                {builtIn.map(story => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onSelect={() => { setSelectedStory(story); setView('difficulty-picker') }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Vista principal: Menú principal ─────────────────────────────────────

  const activeSessions   = sessions.filter(s => s.status === 'active')
  const finishedSessions = sessions.filter(s => s.status === 'finished')
  const abandonedSessions = sessions.filter(s => s.status === 'abandoned')
  const fameSessions     = sessions.filter(s => s.session_recap != null)

  const TABS = [
    { id: 'active',   label: 'Activas',   count: activeSessions.length },
    { id: 'finished', label: 'Terminadas', count: finishedSessions.length },
    { id: 'abandoned',label: 'Archivadas', count: abandonedSessions.length },
    { id: 'fame',     label: 'Salón de la Fama', count: fameSessions.length },
  ]

  return (
    <div
      className="min-h-screen text-ink px-6 py-10"
      style={{ background: 'var(--gradient-lobby)' }}
    >
      <div className="max-w-2xl mx-auto">

        <div className="flex justify-end gap-1 mb-2">
          <FamilyModeToggle familyMode={familyMode} onToggle={toggleFamilyMode} />
          <ThemeToggle />
        </div>

        <div className="text-center mb-12">
          <div className="inline-block border-b border-gold/20 pb-6 mb-2 w-full">
            <h1
              className="text-5xl font-bold text-gold-bright tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 40px color-mix(in srgb, var(--accent-gold) 20%, transparent)' }}
            >
              ⚓ Grand Line
            </h1>
            <p className="text-ink-3 text-sm italic">Elige una aventura o empieza una nueva</p>
          </div>
        </div>

        <button
          onClick={() => setView('story-picker')}
          className="w-full mb-8 py-4 rounded-xl font-bold text-lg bg-gold text-canvas hover:bg-gold-bright hover:scale-[1.02] transition-all shadow-lg shadow-gold/20"
        >
          + Nueva aventura
        </button>

        {/* Tabs de sesiones */}
        {!loading && sessions.length > 0 && (
          <div className="flex border-b border-stroke mb-4 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSessionTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors whitespace-nowrap px-2 ${
                  sessionTab === tab.id
                    ? 'text-gold-bright border-b-2 border-gold'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {tab.label}
                {tab.count > 0 && <span className="ml-1 text-[10px] text-ink-off">({tab.count})</span>}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-center text-ink-off animate-pulse text-sm">Cargando sesiones…</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-ink-off italic text-sm mt-8">No hay sesiones todavía.</p>
        ) : sessionTab === 'active' ? (
          /* ── Aventuras activas ─────────────────────────────────────────── */
          activeSessions.length === 0 ? (
            <p className="text-center text-ink-off italic text-sm mt-4">No hay aventuras activas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeSessions.map(session => {
                const isBusy = busy === session.id
                const storyTitle = getStoryTitle(session)
                return (
                  <div
                    key={session.id}
                    onClick={() => !isBusy && onSessionSelect(session)}
                    className="rounded-xl border border-stroke bg-panel px-5 py-4 cursor-pointer hover:border-stroke-3 hover:bg-raised/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${SESSION_STATUS.active.style}`}>
                            {SESSION_STATUS.active.label}
                          </span>
                          {storyTitle && (
                            <span className="text-xs text-gold/70 truncate">📖 {storyTitle}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-ink-off">
                            Inicio: <span className="text-ink-2">{formatDate(session.created_at)}</span>
                          </p>
                          <p className="text-xs text-ink-off">
                            Última actividad: <span className="text-ink-2">{formatDate(session.updated_at)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 divide-x divide-stroke" onClick={e => e.stopPropagation()}>
                        <CopyLinkButton sessionId={session.id} />
                        <button onClick={() => onSessionSelect(session)} disabled={isBusy} title="Entrar"
                          className="p-2 rounded-lg text-gold hover:text-gold-bright hover:bg-gold/10 disabled:opacity-40 transition-colors">
                          <IconEnter />
                        </button>
                        <button onClick={() => handleArchive(session.id)} disabled={isBusy} title="Archivar"
                          className="p-2 rounded-lg text-ink-off hover:text-ink-2 hover:bg-raised/50 disabled:opacity-40 transition-colors">
                          <IconArchive />
                        </button>
                        <button onClick={() => handleDelete(session.id)} disabled={isBusy} title="Borrar"
                          className="p-2 pl-3 rounded-lg text-combat/50 hover:text-combat-light hover:bg-combat/10 disabled:opacity-40 transition-colors">
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : sessionTab === 'finished' ? (
          /* ── Aventuras terminadas ──────────────────────────────────────── */
          finishedSessions.length === 0 ? (
            <p className="text-center text-ink-off italic text-sm mt-4">No hay aventuras terminadas aún.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {finishedSessions.map(session => (
                <div key={session.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onContinueWithCrew(session)}
                      disabled={busy === session.id}
                      className="text-xs font-semibold text-gold border border-gold/30 bg-gold/10 px-3 py-1.5 rounded-lg hover:bg-gold hover:text-canvas transition-all disabled:opacity-40"
                    >
                      ⚔️ Continuar tripulación
                    </button>
                  </div>
                  <SessionHistoryCard session={session} storyTitle={getStoryTitle(session)} />
                </div>
              ))}
            </div>
          )
        ) : sessionTab === 'abandoned' ? (
          /* ── Aventuras archivadas ──────────────────────────────────────── */
          abandonedSessions.length === 0 ? (
            <p className="text-center text-ink-off italic text-sm mt-4">No hay aventuras archivadas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {abandonedSessions.map(session => {
                const isBusy = busy === session.id
                const storyTitle = getStoryTitle(session)
                return (
                  <div
                    key={session.id}
                    className="rounded-xl border border-stroke bg-panel px-5 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${SESSION_STATUS.abandoned.style}`}>
                            {SESSION_STATUS.abandoned.label}
                          </span>
                          {storyTitle && (
                            <span className="text-xs text-gold/70 truncate">📖 {storyTitle}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-ink-off">
                            Inicio: <span className="text-ink-2">{formatDate(session.created_at)}</span>
                          </p>
                          <p className="text-xs text-ink-off">
                            Última actividad: <span className="text-ink-2">{formatDate(session.updated_at)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 divide-x divide-stroke">
                        <button onClick={() => handleRestore(session.id)} disabled={isBusy} title="Retomar"
                          className="p-2 rounded-lg text-exploration-light hover:bg-exploration/10 disabled:opacity-40 transition-colors">
                          <IconRestore />
                        </button>
                        <button onClick={() => handleDelete(session.id)} disabled={isBusy} title="Eliminar"
                          className="p-2 pl-3 rounded-lg text-combat/50 hover:text-combat-light hover:bg-combat/10 disabled:opacity-40 transition-colors">
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* ── Salón de la Fama ──────────────────────────────────────────── */
          fameSessions.length === 0 ? (
            <p className="text-center text-ink-off italic text-sm mt-4">Ninguna aventura tiene resumen todavía.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {fameSessions.map(session => (
                <SessionHistoryCard key={session.id} session={session} storyTitle={getStoryTitle(session)} />
              ))}
            </div>
          )
        )}

      </div>
    </div>
  )
}

// ─── StoryCard ────────────────────────────────────────────────────────────────

function StoryCard({ story, onSelect, onEdit, onDelete }) {
  return (
    <div
      onClick={onSelect}
      className="w-full text-left rounded-xl border border-stroke bg-panel px-6 py-5 hover:border-gold/40 hover:bg-raised/60 transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-ink group-hover:text-gold-bright transition-colors">{story.title}</h3>
            {story.is_custom && (
              <span className="text-xs text-gold/60 border border-gold/25 px-1.5 py-0 rounded shrink-0">Personalizada</span>
            )}
          </div>
          <p className="text-sm text-ink-3">{story.description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {story.estimated_minutes && (
            <span className="text-xs text-ink-off mt-0.5">~{story.estimated_minutes} min</span>
          )}
          {story.is_custom && onEdit && (
            <button
              onClick={onEdit}
              title="Editar"
              className="ml-2 p-1.5 rounded-lg text-ink-3 hover:text-ink-2 hover:bg-raised/60 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
          )}
          {story.is_custom && onDelete && (
            <button
              onClick={onDelete}
              title="Borrar"
              className="p-1.5 rounded-lg text-combat/40 hover:text-combat-light hover:bg-combat/10 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Lobby
