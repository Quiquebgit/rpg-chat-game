import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { characters } from '../data/characters'

const STATUS = {
  active:    { label: 'Activa',     style: 'text-green-400 bg-green-400/10 border-green-400/30' },
  finished:  { label: 'Terminada',  style: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  abandoned: { label: 'Abandonada', style: 'text-gray-500 bg-gray-500/10 border-gray-500/30' },
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Lobby({ onSessionSelect }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadSessions()

    // Actualizar lista si cambia alguna sesión
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
      .order('updated_at', { ascending: false })

    if (error) console.error('Error cargando sesiones:', error)
    else setSessions(data || [])
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
            <p className="text-xs uppercase tracking-widest text-gray-600 mb-1">Aventuras anteriores</p>
            {sessions.map(session => {
              const status = STATUS[session.status] || STATUS.abandoned
              const isActive = session.status === 'active'
              return (
                <button
                  key={session.id}
                  onClick={() => isActive && onSessionSelect(session)}
                  disabled={!isActive}
                  className={`w-full text-left rounded-xl border px-5 py-4 transition-colors ${
                    isActive
                      ? 'border-gray-700 bg-gray-900 hover:border-amber-400/40 hover:bg-gray-800'
                      : 'border-gray-800 bg-gray-900/40 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
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
                    {isActive && <span className="text-amber-400 text-xl shrink-0">›</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export default Lobby
