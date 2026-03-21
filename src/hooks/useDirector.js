// Hook que gestiona el Director de Guion durante la partida.
// Se encarga de: cargar la plantilla activa, exponer el evento actual
// y avanzar al siguiente cuando el mecánico detecta que se ha completado.

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { advanceToNextEvent } from '../lib/director'

// Carga todos los ficheros .md de historias como texto plano (eager = disponibles síncronamente)
const STORY_FILES = import.meta.glob('../data/stories/*.md', { query: '?raw', import: 'default', eager: true })

export function useDirector(session) {
  const [template, setTemplate] = useState(null)
  const [directorReady, setDirectorReady] = useState(false)
  const templateRef = useRef(null)
  const advancingRef = useRef(false) // evitar llamadas simultáneas

  // Cargar la plantilla de dificultad cuando cambia la sesión
  useEffect(() => {
    if (!session?.difficulty_template_id) {
      setDirectorReady(true) // sesión sin historia: ready inmediatamente
      return
    }
    loadTemplate(session.difficulty_template_id)
  }, [session?.difficulty_template_id])

  async function loadTemplate(templateId) {
    const { data, error } = await supabase
      .from('difficulty_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error) {
      console.error('[director] Error cargando plantilla:', error)
      setDirectorReady(true)
      return
    }

    templateRef.current = data
    setTemplate(data)
    setDirectorReady(true)
  }

  // Evento actual según el orden guardado en la sesión
  function getCurrentEventSetup() {
    const tmpl = templateRef.current
    if (!tmpl) return null
    const order = session?.current_event_order || 1
    return tmpl.events.find(e => e.order === order) || null
  }

  // Llamado cuando el mecánico detecta que el evento actual se ha completado.
  // Llama al Director para obtener la transición y el briefing del siguiente evento.
  async function completeCurrentEvent() {
    if (!session?.difficulty_template_id) return // sesión sin historia
    if (!templateRef.current) return
    if (advancingRef.current) return // ya está procesando
    advancingRef.current = true

    try {
      // Usar la sesión más fresca (con current_event_order actualizado)
      const { data: freshSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', session.id)
        .single()

      if (freshSession) {
        await advanceToNextEvent(freshSession, templateRef.current)
      }
    } catch (err) {
      console.error('[director] Error completando evento:', err)
    } finally {
      advancingRef.current = false
    }
  }

  // Obtiene el contenido completo del .md de la historia activa
  function getStoryContent() {
    if (!session?.story_file) return null
    const key = `../data/stories/${session.story_file}`
    return STORY_FILES[key] || null
  }

  return {
    directorReady,
    template,
    currentEventSetup: getCurrentEventSetup(),
    completeCurrentEvent,
    getStoryContent,
    hasStory: !!session?.difficulty_template_id,
  }
}
