import Groq from 'groq-sdk'
import { getRandomItem, GET_RANDOM_ITEM_TOOL } from './items'

const groqClient = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MECHANICS_MODEL = 'llama-3.1-8b-instant'
const NARRATOR_MODEL = 'llama-3.3-70b-versatile'

// Mapa de herramientas disponibles para el modelo mecánico
const TOOL_EXECUTORS = { getRandomItem }
const MECHANICS_TOOLS = [GET_RANDOM_ITEM_TOOL]

// Modelo mecánico: JSON estricto, reglas del juego, sin narrativa
// useTools: activa function calling (getRandomItem). No usar para resúmenes.
// Reintenta una vez tras 3s si recibe 429 (rate limit)
export async function callMechanicsModel(systemPrompt, userPrompt, { json = true, maxTokens = 400, temperature = 0.1, useTools = false } = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  const tools = useTools ? MECHANICS_TOOLS : undefined

  async function attempt() {
    // Primera llamada: con tools si aplica. Sin response_format para no conflictar con tool_choice.
    const completion = await groqClient.chat.completions.create({
      model: MECHANICS_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
      ...(json && !tools ? { response_format: { type: 'json_object' } } : {}),
    })

    const responseMessage = completion.choices[0]?.message

    // Si el modelo llamó a una herramienta, ejecutarla y hacer segunda llamada
    if (responseMessage?.tool_calls?.length > 0) {
      const toolResultMessages = []
      for (const toolCall of responseMessage.tool_calls) {
        const fn = TOOL_EXECUTORS[toolCall.function.name]
        let result = null
        if (fn) {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            result = await fn(args)
          } catch (e) {
            console.error(`Error ejecutando tool "${toolCall.function.name}":`, e)
          }
        }
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result ? JSON.stringify(result) : 'ERROR: No se encontró ningún item con esos filtros. Deja inventory_updates vacío.',
        })
      }
      const completion2 = await groqClient.chat.completions.create({
        model: MECHANICS_MODEL,
        messages: [...messages, responseMessage, ...toolResultMessages],
        max_tokens: maxTokens,
        temperature,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      })
      return completion2.choices[0]?.message?.content?.trim() || null
    }

    return responseMessage?.content?.trim() || null
  }

  try {
    return await attempt()
  } catch (err) {
    const status = err?.status || err?.error?.status
    if (status === 429) {
      console.warn(`[mecánico] Rate limit (429), reintentando en 3s…`)
      await new Promise(r => setTimeout(r, 3000))
      try {
        return await attempt()
      } catch (retryErr) {
        console.error('[mecánico] Reintento también falló:', retryErr)
        return null
      }
    }
    throw err
  }
}

// Modelo narrador: texto dramático libre, sin JSON
// Si el modelo versatile falla (rate limit, error 429...) hace fallback al instant
export async function callNarratorModel(systemPrompt, userPrompt) {
  const params = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.85,
  }

  try {
    const completion = await groqClient.chat.completions.create({ ...params, model: NARRATOR_MODEL })
    return completion.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    const status = err?.status || err?.error?.status
    if (status === 429 || status === 503 || status >= 500) {
      console.warn(`Narrador (${NARRATOR_MODEL}) no disponible (${status}), usando fallback ${MECHANICS_MODEL}`)
      try {
        const fallback = await groqClient.chat.completions.create({ ...params, model: MECHANICS_MODEL })
        return fallback.choices[0]?.message?.content?.trim() || null
      } catch (fallbackErr) {
        console.error('Fallback también falló:', fallbackErr)
        return null
      }
    }
    throw err
  }
}
