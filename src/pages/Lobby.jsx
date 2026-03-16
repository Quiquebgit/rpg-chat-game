import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { characters } from '../data/characters'

const STATUS = {
  active:    { label: 'Activa',    style: 'text-green-400 bg-green-400/10 border-green-400/30' },
  finished:  { label: 'Terminada', style: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  abandoned: { label: 'Archivada', style: 'text-gray-500 bg-gray-500/10 border-gray-500/30' },
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Icono: entrar (flecha derecha)
function IconEnter() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

// Icono: archivar (bandeja con flecha abajo)
function IconArchive() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

// Icono: restaurar (flecha circular)
function IconRestore() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

// Icono: borrar (papelera)
function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function Lobby({ onSessionSelect }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    loadSessions()

    const sub = supabase
      .channel('lobby-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, loadSessions)
      .subscribe()

    return () => sub.unsubscribe()
  }, [])

  async function loadSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')

    if (error) console.error('Error cargando sesiones:', error)
    else {
      // Ordenar por última actividad desc, luego por fecha de inicio desc
      const sorted = (data || []).sort((a, b) => {
        const byActivity = new Date(b.updated_at) - new Date(a.updated_at)
        if (byActivity !== 0) return byActivity
        return new Date(b.created_at) - new Date(a.created_at)
      })
      setSessions(sorted)
    }
    setLoading(false)
  }

  async function handleNewSession() {
    setCreating(true)
    const turnOrder = characters.map(c => c.id)

    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({ status: 'active', turn_order: turnOrder, current_turn_character_id: turnOrder[0] })
      .select()
      .single()

    if (error) {
      console.error('Error creando sesión:', error)
      setCreating(false)
      return
    }

    await supabase.from('session_character_state').insert(
      characters.map(c => ({ session_id: newSession.id, character_id: c.id, hp_current: c.hp, inventory: [] }))
    )

    setCreating(false)
    onSessionSelect(newSession)
  }

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

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-amber-300 tracking-wide">⚓ Grand Line</h1>
          <p className="text-gray-500 mt-2 text-sm">Elige una aventura o empieza una nueva</p>
        </div>

        <button
          onClick={handleNewSession}
          disabled={creating}
          className="w-full mb-8 py-4 rounded-xl font-bold text-lg bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-amber-400/20"
        >
          {creating ? 'Preparando la aventura…' : '+ Nueva sesión'}
        </button>

        {loading ? (
          <p className="text-center text-gray-600 animate-pulse text-sm">Cargando sesiones…</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-gray-700 italic text-sm mt-8">No hay sesiones todavía.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(session => {
              const status = STATUS[session.status] || STATUS.abandoned
              const isActive = session.status === 'active'
              const isBusy = busy === session.id

              return (
                <div
                  key={session.id}
                  onClick={() => !isBusy && onSessionSelect(session)}
                  className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Info */}
                    <div className="flex flex-col gap-2 min-w-0">
                      <span className={`self-start text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${status.style}`}>
                        {status.label}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-gray-600">
                          Inicio: <span className="text-gray-400">{formatDate(session.created_at)}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          Última actividad: <span className="text-gray-400">{formatDate(session.updated_at)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Iconos de acción */}
                    <div className="flex items-center gap-1 shrink-0 divide-x divide-gray-800" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSessionSelect(session)}
                        disabled={isBusy}
                        title="Entrar"
                        className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 disabled:opacity-40 transition-colors"
                      >
                        <IconEnter />
                      </button>
                      {isActive ? (
                        <button
                          onClick={() => handleArchive(session.id)}
                          disabled={isBusy}
                          title="Archivar"
                          className="p-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                        >
                          <IconArchive />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(session.id)}
                          disabled={isBusy}
                          title="Restaurar"
                          className="p-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                        >
                          <IconRestore />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={isBusy}
                        title="Borrar"
                        className="p-2 pl-3 rounded-lg text-red-900 hover:text-red-500 hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                      >
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
