import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Formulario para crear o editar una historia personalizada.
// Props:
//   story   — historia existente (null = crear nueva)
//   onSaved — callback tras guardar con éxito
//   onCancel — callback al cancelar
export default function StoryEditor({ story, onSaved, onCancel }) {
  const [title, setTitle] = useState(story?.title || '')
  const [description, setDescription] = useState(story?.description || '')
  const [minutes, setMinutes] = useState(story?.estimated_minutes ?? 45)
  const [lore, setLore] = useState(story?.lore || LORE_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isEditing = !!story

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !lore.trim()) {
      setError('Título, descripción y lore son obligatorios.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      description: description.trim(),
      estimated_minutes: Number(minutes) || 45,
      lore: lore.trim(),
      is_custom: true,
    }

    let err
    if (isEditing) {
      ;({ error: err } = await supabase.from('stories').update(payload).eq('id', story.id))
    } else {
      ;({ error: err } = await supabase.from('stories').insert(payload))
    }

    setSaving(false)
    if (err) { setError('Error al guardar. Inténtalo de nuevo.'); return }
    onSaved()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gold-bright mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        {isEditing ? 'Editar historia' : 'Crear historia'}
      </h2>
      <p className="text-sm text-ink-3 mb-8">
        El lore es lo que el Director leerá para narrar la aventura. Cuanto más detallado, mejor.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-5">

        {/* Título */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-ink-3 font-semibold">Título *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="El Heist de la Torre de Sal"
            className="bg-panel border border-stroke rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-off focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-ink-3 font-semibold">Descripción *</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Una frase corta que enganche a los jugadores en el lobby"
            className="bg-panel border border-stroke rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-off focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>

        {/* Minutos */}
        <div className="flex flex-col gap-1.5 max-w-[180px]">
          <label className="text-xs uppercase tracking-widest text-ink-3 font-semibold">Duración estimada (min)</label>
          <input
            type="number"
            value={minutes}
            min={15}
            max={240}
            onChange={e => setMinutes(e.target.value)}
            className="bg-panel border border-stroke rounded-lg px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>

        {/* Lore */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-ink-3 font-semibold">Lore *</label>
          <p className="text-xs text-ink-off -mt-1">
            Describe el mundo, los personajes clave, los lugares y el tono. El Director lo usará para narrar.
          </p>
          <textarea
            value={lore}
            onChange={e => setLore(e.target.value)}
            rows={16}
            className="bg-panel border border-stroke rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-off focus:outline-none focus:border-gold/50 transition-colors resize-y font-mono leading-relaxed"
          />
        </div>

        {error && (
          <p className="text-sm text-combat-light bg-combat/10 border border-combat/30 rounded-lg px-4 py-2.5">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-bold bg-gold text-canvas hover:bg-gold-bright disabled:opacity-50 transition-all"
          >
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear historia'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-xl font-semibold border border-stroke text-ink-2 hover:bg-raised/50 transition-all"
          >
            Cancelar
          </button>
        </div>

      </form>
    </div>
  )
}

// Plantilla de lore para historias nuevas
const LORE_TEMPLATE = `# LORE PERMANENTE

## Ambientación
Describe el lugar, la atmósfera y el contexto de la historia.

## Tono
Define el tono narrativo: oscuro, épico, humorístico, misterioso...

## Personajes clave
- **Nombre:** Descripción del personaje y su rol en la historia.

## Lugares importantes
- **Nombre:** Descripción del lugar y por qué importa.

## Elementos recurrentes
Detalles sensoriales o narrativos que se repiten para dar coherencia: olores, sonidos, imágenes.`