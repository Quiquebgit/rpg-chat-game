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
export async function callMechanicsModel(systemPrompt, userPrompt, { json = true, maxTokens = 400, temperature = 0.1, useTools = false } = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const tools = useTools ? MECHANICS_TOOLS : undefined

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
        content: JSON.stringify(result),
      })
    }

    // Segunda llamada con el resultado de la herramienta: ahora sí forzamos JSON
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

// Modelo narrador: texto dramático libre, sin JSON
export async function callNarratorModel(systemPrompt, userPrompt) {
  const completion = await groqClient.chat.completions.create({
    model: NARRATOR_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.85,
  })
  return completion.choices[0]?.message?.content?.trim() || null
}
